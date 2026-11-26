package com.example.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ChartPoint
import com.example.data.UserEntity
import com.example.data.UserRole
import com.example.ui.theme.BgBlack
import com.example.ui.theme.BorderSubtle
import com.example.ui.theme.DangerText
import com.example.ui.theme.Lime
import com.example.ui.theme.Surface1
import com.example.ui.theme.Surface2
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary

@Composable
fun ProfileScreen(
    state: IronLogUiState,
    onLogWeight: (Double) -> Unit,
    onDeleteWeight: (String) -> Unit,
    onOpenAdminPanel: () -> Unit,
    onCloseAdminPanel: () -> Unit,
    onAdminCreateUser: (String, String, UserRole) -> Unit,
    onAdminToggleBlock: (String, Boolean) -> Unit,
    onAdminResetPassword: (String, String, String) -> Unit,
    onAdminDeleteUser: (String) -> Unit,
    onLogout: () -> Unit
) {
    val user = state.currentUser ?: return
    val isAdmin = user.role == UserRole.ADMIN.name

    if (state.adminPanelOpen && isAdmin) {
        AdminPanelView(
            currentUserId = user.id,
            users = state.adminUsers,
            onBack = onCloseAdminPanel,
            onCreateUser = onAdminCreateUser,
            onToggleBlock = onAdminToggleBlock,
            onResetPassword = onAdminResetPassword,
            onDeleteUser = onAdminDeleteUser
        )
        return
    }

    var weightInput by remember { mutableStateOf("") }
    val weightPoints = state.weightLogs
        .take(10)
        .reversed()
        .map { ChartPoint(IronLogViewModel.formatShortDate(it.recordedAt), it.weightKg) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        IronCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Usuário conectado", color = TextMuted, fontSize = 12.sp)
                    Text(
                        text = "@${user.username}",
                        color = TextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black
                    )
                }
                IronBadge(text = user.role, accent = isAdmin)
            }
            if (isAdmin) {
                Spacer(Modifier.height(12.dp))
                IronPrimaryButton(
                    text = "Painel Administrativo",
                    onClick = onOpenAdminPanel,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        SectionHeader(title = "Peso Corporal", modifier = Modifier.padding(top = 4.dp))
        IronCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                IronTextField(
                    value = weightInput,
                    onValueChange = { weightInput = it },
                    label = "Peso atual (kg)",
                    placeholder = "ex: 78.5",
                    modifier = Modifier.weight(1f)
                )
                IronPrimaryButton(
                    text = "Registrar",
                    onClick = {
                        val parsed = weightInput.replace(',', '.').toDoubleOrNull() ?: 0.0
                        onLogWeight(parsed)
                        if (parsed > 0.0) weightInput = ""
                    },
                    compact = true,
                    modifier = Modifier.padding(bottom = 3.dp)
                )
            }

            Spacer(Modifier.height(8.dp))
            IronLineChart(
                points = weightPoints,
                unit = "kg",
                emptyText = "Registre pelo menos 2 pesos para ver o gráfico."
            )

            if (state.weightLogs.isNotEmpty()) {
                HorizontalDivider(color = BorderSubtle, modifier = Modifier.padding(vertical = 8.dp))
                state.weightLogs.take(8).forEach { w ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${IronLogViewModel.formatKg(w.weightKg)} kg • ${IronLogViewModel.formatDate(w.recordedAt)}",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        TextButton(onClick = { onDeleteWeight(w.id) }) {
                            Text("Excluir", color = DangerText, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        IronSecondaryButton(
            text = "Sair da conta",
            onClick = onLogout,
            danger = true,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdminPanelView(
    currentUserId: String,
    users: List<UserEntity>,
    onBack: () -> Unit,
    onCreateUser: (String, String, UserRole) -> Unit,
    onToggleBlock: (String, Boolean) -> Unit,
    onResetPassword: (String, String, String) -> Unit,
    onDeleteUser: (String) -> Unit
) {
    var newUsername by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var newRole by remember { mutableStateOf(UserRole.ALUNO) }
    var search by remember { mutableStateOf("") }

    var resetTarget by remember { mutableStateOf<UserEntity?>(null) }
    var resetPass by remember { mutableStateOf("") }
    var resetConfirm by remember { mutableStateOf("") }

    var deleteTarget by remember { mutableStateOf<UserEntity?>(null) }

    val filtered = users.filter {
        val q = search.trim().lowercase()
        q.isEmpty() || it.username.lowercase().contains(q)
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Painel Admin", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            IronSecondaryButton(text = "Voltar ao Perfil", onClick = onBack, compact = true)
        }

        IronCard {
            Text("Criar nova conta", color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
            Spacer(Modifier.height(10.dp))
            IronTextField(
                value = newUsername,
                onValueChange = { newUsername = it },
                label = "Nome de usuário",
                placeholder = "ex: aluno01"
            )
            Spacer(Modifier.height(8.dp))
            IronTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = "Senha (mínimo 6 caracteres)",
                visualTransformation = PasswordVisualTransformation()
            )
            Spacer(Modifier.height(10.dp))
            Text("Função", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(5.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Surface2)
                    .padding(4.dp)
            ) {
                UserRole.entries.forEach { role ->
                    val active = newRole == role
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (active) Lime else Surface2)
                            .clickable { newRole = role }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = role.name,
                            color = if (active) BgBlack else TextMuted,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            IronPrimaryButton(
                text = "Criar conta de usuário",
                onClick = {
                    onCreateUser(newUsername, newPassword, newRole)
                    newUsername = ""
                    newPassword = ""
                },
                modifier = Modifier.fillMaxWidth()
            )
        }

        SectionHeader(title = "Usuários (${filtered.size})")
        IronTextField(
            value = search,
            onValueChange = { search = it },
            label = "Buscar usuário",
            placeholder = "Filtrar por nome..."
        )

        filtered.forEach { u ->
            val isSelf = u.id == currentUserId
            IronCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "@${u.username}${if (isSelf) " (Você)" else ""}",
                            color = TextPrimary,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Criado em ${IronLogViewModel.formatDate(u.createdAt)}",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        IronBadge(text = u.role, accent = u.role == UserRole.ADMIN.name)
                        if (u.isBlocked) IronBadge(text = "Bloqueado", danger = true)
                    }
                }

                if (!isSelf) {
                    Spacer(Modifier.height(10.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        IronSecondaryButton(
                            text = if (u.isBlocked) "Desbloquear" else "Bloquear",
                            onClick = { onToggleBlock(u.id, !u.isBlocked) },
                            compact = true
                        )
                        IronSecondaryButton(
                            text = "Redefinir senha",
                            onClick = {
                                resetPass = ""
                                resetConfirm = ""
                                resetTarget = u
                            },
                            compact = true
                        )
                        IronSecondaryButton(
                            text = "Excluir",
                            onClick = { deleteTarget = u },
                            danger = true,
                            compact = true
                        )
                    }
                }
            }
        }
    }

    val rTarget = resetTarget
    if (rTarget != null) {
        AlertDialog(
            onDismissRequest = { resetTarget = null },
            containerColor = Surface1,
            title = { Text("Redefinir senha: @${rTarget.username}", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    IronTextField(
                        value = resetPass,
                        onValueChange = { resetPass = it },
                        label = "Nova senha (mínimo 6 caracteres)",
                        visualTransformation = PasswordVisualTransformation()
                    )
                    IronTextField(
                        value = resetConfirm,
                        onValueChange = { resetConfirm = it },
                        label = "Confirmar nova senha",
                        visualTransformation = PasswordVisualTransformation()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    onResetPassword(rTarget.id, resetPass, resetConfirm)
                    resetTarget = null
                }) {
                    Text("Salvar", color = Lime, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { resetTarget = null }) {
                    Text("Cancelar", color = TextMuted)
                }
            }
        )
    }

    val dTarget = deleteTarget
    if (dTarget != null) {
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            containerColor = Surface1,
            title = { Text("Excluir @${dTarget.username}?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Esta ação remove permanentemente o usuário e todos os seus treinos.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    onDeleteUser(dTarget.id)
                    deleteTarget = null
                }) {
                    Text("Excluir", color = DangerText, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text("Cancelar", color = TextMuted)
                }
            }
        )
    }
}
