package com.meghdrishti.ai.ui.screens

import android.app.Activity
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meghdrishti.ai.R
import com.meghdrishti.ai.ui.theme.*
import com.meghdrishti.ai.ui.viewmodel.MeghDrishtiViewModel
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    viewModel: MeghDrishtiViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isSigningIn by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavy)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.AccountCircle,
            contentDescription = null,
            tint = CyanAccent,
            modifier = Modifier.size(72.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "ACCOUNT SIGN-IN",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Black,
            color = CyanAccent
        )

        Text(
            text = "Optional Firebase sync for local alert drills",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(28.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            border = CardDefaults.outlinedCardBorder().let {
                androidx.compose.foundation.BorderStroke(1.dp, CyanAccent.copy(alpha = 0.3f))
            }
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (state.currentUser != null) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = ImdGreen,
                        modifier = Modifier.size(36.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Signed-In Account",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = state.currentUser?.email ?: state.currentUser?.displayName ?: "Operator ID Active",
                        style = MaterialTheme.typography.bodySmall,
                        color = TealAccent
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = { viewModel.signOut() },
                        colors = ButtonDefaults.buttonColors(containerColor = ImdRed),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(imageVector = Icons.Default.ExitToApp, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sign Out")
                    }
                } else {
                    Text(
                        text = "Sign in with Google to sync drill records to your configured Firebase project. Firebase setup is required.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            val activity = context as? Activity ?: return@Button
                            val webClientId = context.getString(R.string.default_web_client_id)
                            coroutineScope.launch {
                                isSigningIn = true
                                val result = viewModel.authHelper.signInWithGoogle(webClientId)
                                isSigningIn = false
                                if (result.isSuccess) {
                                    viewModel.checkCurrentUser()
                                    Toast.makeText(context, "Welcome, Responder!", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "Sign in: ${result.exceptionOrNull()?.message ?: "Check Google Play Services"}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        enabled = !isSigningIn,
                        colors = ButtonDefaults.buttonColors(containerColor = CyanAccent),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isSigningIn) {
                            CircularProgressIndicator(color = DarkNavy, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Sign In with Google", color = DarkNavy, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
