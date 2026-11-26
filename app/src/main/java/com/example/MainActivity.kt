package com.example

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.MainTab
import com.example.ui.AuthScreen
import com.example.ui.BrandHeader
import com.example.ui.DashboardScreen
import com.example.ui.HistoryScreen
import com.example.ui.IronLogViewModel
import com.example.ui.ProfileScreen
import com.example.ui.RestScheduleDialog
import com.example.ui.RestTimerBar
import com.example.ui.WorkoutsScreen
import com.example.ui.theme.BgBlack
import com.example.ui.theme.BorderSubtle
import com.example.ui.theme.Danger
import com.example.ui.theme.DangerText
import com.example.ui.theme.IronLogTheme
import com.example.ui.theme.Lime
import com.example.ui.theme.NavBg
import com.example.ui.theme.Surface2
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val viewModel: IronLogViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(BgBlack.toArgb()),
            navigationBarStyle = SystemBarStyle.dark(NavBg.toArgb())
        )
        setContent {
            IronLogTheme {
                IronLogRoot(viewModel)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.timerManager.restoreIfActive()
    }
}

@Composable
private fun IronLogRoot(viewModel: IronLogViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val timer by viewModel.timerState.collectAsStateWithLifecycle()
    val timerRemaining by viewModel.timerRemainingSec.collectAsStateWithLifecycle()
    var historySessionId by remember { mutableStateOf<String?>(null) }
    var showScheduleModal by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    fun ensureNotificationPermissionOnce() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    // Auto-clear toast
    LaunchedEffect(state.toastMessage) {
        if (state.toastMessage != null) {
            delay(3200)
            viewModel.clearToast()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BgBlack)
    ) {
        when {
            state.isBooting -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Carregando FÉ & FERRO...", color = TextMuted, fontSize = 14.sp)
                }
            }

            state.currentUser == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding()
                ) {
                    AuthScreen(
                        hasAdmin = state.hasAdmin,
                        onClaimAdmin = viewModel::claimInitialAdmin,
                        onLogin = viewModel::login,
                        onRegister = viewModel::registerStudent
                    )
                }
            }

            else -> {
                val user = state.currentUser!!
                Scaffold(
                    containerColor = BgBlack,
                    contentWindowInsets = WindowInsets(0, 0, 0, 0),
                    bottomBar = {
                        IronBottomNav(
                            currentTab = state.currentTab,
                            onSelectTab = viewModel::selectTab
                        )
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                            .statusBarsPadding()
                    ) {
                        val bottomSpacer = if (timer != null) 140.dp else 18.dp
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 14.dp, vertical = 12.dp)
                        ) {
                            BrandHeader(username = user.username, role = user.role)

                            when (state.currentTab) {
                                MainTab.INICIO -> DashboardScreen(
                                    state = state,
                                    onResumeActive = { viewModel.selectTab(MainTab.TREINOS) },
                                    onStartWorkout = { wkId ->
                                        ensureNotificationPermissionOnce()
                                        viewModel.startWorkout(wkId)
                                    },
                                    onOpenSessionDetail = { sid ->
                                        historySessionId = sid
                                        viewModel.selectTab(MainTab.HISTORICO)
                                    },
                                    onOpenScheduleConfig = { showScheduleModal = true }
                                )

                                MainTab.TREINOS -> WorkoutsScreen(
                                    state = state,
                                    activeTimer = timer,
                                    timerRemainingSec = timerRemaining,
                                    onStartWorkout = { wkId ->
                                        ensureNotificationPermissionOnce()
                                        viewModel.startWorkout(wkId)
                                    },
                                    onOpenScheduleConfig = { showScheduleModal = true },
                                    onStartSetTimer = { setLog, sec ->
                                        ensureNotificationPermissionOnce()
                                        viewModel.timerManager.start(setLog.id, setLog.exerciseName, sec)
                                    },
                                    onTogglePauseTimer = viewModel.timerManager::togglePause,
                                    onRestartTimer = viewModel.timerManager::restart,
                                    onSkipTimer = viewModel.timerManager::skip,
                                    onUpdateSet = viewModel::updateSetField,
                                    onToggleSetDone = { setId ->
                                        ensureNotificationPermissionOnce()
                                        viewModel.toggleSetCompleted(setId)
                                    },
                                    onAddSet = viewModel::addSet,
                                    onDeleteSet = viewModel::deleteSet,
                                    onSubstituteExercise = viewModel::substituteExercise,
                                    onFinishSession = viewModel::finishActiveSession,
                                    onDiscardSession = viewModel::discardActiveSession
                                )

                                MainTab.HISTORICO -> HistoryScreen(
                                    state = state,
                                    viewModel = viewModel,
                                    selectedSessionId = historySessionId,
                                    onOpenSession = { historySessionId = it }
                                )

                                MainTab.PERFIL -> ProfileScreen(
                                    state = state,
                                    onLogWeight = viewModel::logBodyWeight,
                                    onDeleteWeight = viewModel::deleteBodyWeight,
                                    onOpenAdminPanel = viewModel::openAdminPanel,
                                    onCloseAdminPanel = viewModel::closeAdminPanel,
                                    onAdminCreateUser = viewModel::adminCreateUser,
                                    onAdminToggleBlock = viewModel::adminToggleBlock,
                                    onAdminResetPassword = viewModel::adminResetPassword,
                                    onAdminDeleteUser = viewModel::adminDeleteUser,
                                    onLogout = viewModel::logout
                                )
                            }

                            Spacer(Modifier.height(bottomSpacer))
                        }

                        // Floating Rest Timer
                        val activeTimer = timer
                        if (activeTimer != null) {
                            RestTimerBar(
                                timer = activeTimer,
                                remainingSec = timerRemaining,
                                onTogglePause = viewModel.timerManager::togglePause,
                                onRestart = viewModel.timerManager::restart,
                                onSkip = viewModel.timerManager::skip,
                                onAdjust = viewModel.timerManager::adjust,
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(horizontal = 10.dp, vertical = 8.dp)
                            )
                        }
                    }
                }

                if (showScheduleModal && state.workouts.isNotEmpty()) {
                    RestScheduleDialog(
                        workouts = state.workouts,
                        onDismiss = { showScheduleModal = false },
                        onSave = viewModel::updateWorkoutSchedule
                    )
                }
            }
        }

        // Toast overlay
        val msg = state.toastMessage
        if (msg != null) {
            Surface(
                shape = RoundedCornerShape(999.dp),
                color = Surface2,
                border = BorderStroke(1.dp, if (state.toastIsError) Danger else Lime),
                shadowElevation = 8.dp,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .statusBarsPadding()
                    .padding(top = 12.dp, start = 16.dp, end = 16.dp)
            ) {
                Text(
                    text = msg,
                    color = if (state.toastIsError) DangerText else TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp)
                )
            }
        }
    }
}

private data class NavItem(
    val tab: MainTab,
    val label: String,
    val icon: ImageVector
)

@Composable
private fun IronBottomNav(
    currentTab: MainTab,
    onSelectTab: (MainTab) -> Unit
) {
    val items = listOf(
        NavItem(MainTab.INICIO, "Início", Icons.Filled.Home),
        NavItem(MainTab.TREINOS, "Treinos", Icons.Filled.FitnessCenter),
        NavItem(MainTab.HISTORICO, "Histórico", Icons.Filled.ShowChart),
        NavItem(MainTab.PERFIL, "Perfil", Icons.Filled.Person)
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(NavBg)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(color = BorderSubtle, thickness = 1.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                val selected = item.tab == currentTab
                val tint = if (selected) Lime else TextMuted
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelectTab(item.tab) }
                        .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.label,
                        tint = tint,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text = item.label,
                        color = tint,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
