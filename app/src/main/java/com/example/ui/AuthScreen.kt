package com.example.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.BgBlack
import com.example.ui.theme.Lime
import com.example.ui.theme.Surface2
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary

@Composable
fun AuthScreen(
    hasAdmin: Boolean,
    onClaimAdmin: (String, String, String) -> Unit,
    onLogin: (String, String) -> Unit,
    onRegister: (String, String, String) -> Unit
) {
    var authTab by remember { mutableStateOf(0) } // 0 = Entrar, 1 = Cadastrar
    var adminUser by remember { mutableStateOf("") }
    var adminPass by remember { mutableStateOf("") }
    var adminConfirm by remember { mutableStateOf("") }

    var loginUser by remember { mutableStateOf("") }
    var loginPass by remember { mutableStateOf("") }

    var regUser by remember { mutableStateOf("") }
    var regPass by remember { mutableStateOf("") }
    var regConfirm by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgBlack)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        // Brand
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(14.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Lime)
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = "FÉ & FERRO",
                color = TextPrimary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.4.sp
            )
        }
        Text(
            text = "TREINE COM PROPÓSITO.",
            color = Lime,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 6.dp, bottom = 22.dp)
        )

        if (!hasAdmin) {
            IronCard(highlight = true) {
                IronBadge(text = "Configuração inicial", accent = true)
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Criar conta ADMIN principal",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = "Defina o e-mail e a senha do administrador. Esta conta gerencia os alunos e também registra seus próprios treinos.",
                    color = TextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
                )
                IronTextField(
                    value = adminUser,
                    onValueChange = { adminUser = it },
                    label = "E-mail do ADMIN",
                    placeholder = "ex: nome@sobrenome.com"
                )
                Spacer(Modifier.height(10.dp))
                IronTextField(
                    value = adminPass,
                    onValueChange = { adminPass = it },
                    label = "Senha (mínimo 6 caracteres)",
                    visualTransformation = PasswordVisualTransformation()
                )
                Spacer(Modifier.height(10.dp))
                IronTextField(
                    value = adminConfirm,
                    onValueChange = { adminConfirm = it },
                    label = "Confirmar senha",
                    visualTransformation = PasswordVisualTransformation()
                )
                Spacer(Modifier.height(14.dp))
                IronPrimaryButton(
                    text = "Criar conta ADMIN",
                    onClick = { onClaimAdmin(adminUser, adminPass, adminConfirm) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        } else {
            IronCard {
                // Tabs Entrar / Cadastrar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(11.dp))
                        .background(Surface2)
                        .padding(4.dp)
                ) {
                    listOf("Entrar", "Cadastrar").forEachIndexed { idx, label ->
                        val active = authTab == idx
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (active) Lime else Surface2)
                                .clickable { authTab = idx }
                                .padding(vertical = 9.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                color = if (active) BgBlack else TextMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                if (authTab == 0) {
                    IronTextField(
                        value = loginUser,
                        onValueChange = { loginUser = it },
                        label = "E-mail",
                        placeholder = "ex: nome@sobrenome.com"
                    )
                    Spacer(Modifier.height(10.dp))
                    IronTextField(
                        value = loginPass,
                        onValueChange = { loginPass = it },
                        label = "Senha",
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Spacer(Modifier.height(14.dp))
                    IronPrimaryButton(
                        text = "Entrar",
                        onClick = { onLogin(loginUser, loginPass) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(
                        text = "Esqueceu a senha? Solicite a redefinição ao administrador.",
                        color = TextMuted,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                    )
                } else {
                    IronTextField(
                        value = regUser,
                        onValueChange = { regUser = it },
                        label = "E-mail (não precisa ser do Google)",
                        placeholder = "ex: nome@sobrenome.com"
                    )
                    Spacer(Modifier.height(10.dp))
                    IronTextField(
                        value = regPass,
                        onValueChange = { regPass = it },
                        label = "Senha (mínimo 6 caracteres)",
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Spacer(Modifier.height(10.dp))
                    IronTextField(
                        value = regConfirm,
                        onValueChange = { regConfirm = it },
                        label = "Confirmar senha",
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Spacer(Modifier.height(14.dp))
                    IronPrimaryButton(
                        text = "Criar conta",
                        onClick = { onRegister(regUser, regPass, regConfirm) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}
