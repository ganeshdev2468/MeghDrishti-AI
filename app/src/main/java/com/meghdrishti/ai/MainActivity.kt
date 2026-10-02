package com.meghdrishti.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.google.firebase.FirebaseApp
import com.meghdrishti.ai.ui.screens.*
import com.meghdrishti.ai.ui.theme.*
import com.meghdrishti.ai.ui.viewmodel.MeghDrishtiViewModel

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Radar : Screen("radar", "Radar/Sat", Icons.Default.Radar)
    object Inundation : Screen("inundation", "Inundation", Icons.Default.WaterDamage)
    object Nwp : Screen("nwp", "NWP Models", Icons.Default.Analytics)
    object Emergency : Screen("emergency", "Emergency", Icons.Default.NotificationImportant)
    object AiScientist : Screen("ai_scientist", "AI Scientist", Icons.Default.AutoAwesome)
    object Auth : Screen("auth", "Auth", Icons.Default.AccountCircle)
}

class MainActivity : ComponentActivity() {

    private val viewModel: MeghDrishtiViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        try {
            FirebaseApp.initializeApp(this)
        } catch (_: Exception) {
            // Safe fallback if Firebase is already initialized or offline
        }

        setContent {
            MeghDrishtiTheme {
                MainAppScaffold(viewModel = viewModel)
            }
        }
    }
}

@Composable
fun MainAppScaffold(viewModel: MeghDrishtiViewModel) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val state by viewModel.uiState.collectAsState()

    val navItems = listOf(
        Screen.Radar,
        Screen.Inundation,
        Screen.Nwp,
        Screen.Emergency,
        Screen.AiScientist,
        Screen.Auth
    )

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar(
                containerColor = DarkSurface,
                tonalElevation = 8.dp
            ) {
                navItems.forEach { screen ->
                    val isSelected = currentRoute == screen.route
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            if (currentRoute != screen.route) {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        },
                        icon = {
                            BadgedBox(
                                badge = {
                                    if (screen == Screen.Emergency && state.unreadCriticalAlerts > 0) {
                                        Badge(containerColor = ImdRed) {
                                            Text(text = "${state.unreadCriticalAlerts}")
                                        }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = screen.icon,
                                    contentDescription = screen.title,
                                    tint = if (isSelected) CyanAccent else TextSecondary
                                )
                            }
                        },
                        label = {
                            Text(
                                text = screen.title,
                                fontSize = 10.sp,
                                color = if (isSelected) CyanAccent else TextSecondary
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = CyanAccent,
                            selectedTextColor = CyanAccent,
                            indicatorColor = DarkCard
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Radar.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Radar.route) {
                RadarSatelliteScreen(viewModel = viewModel)
            }
            composable(Screen.Inundation.route) {
                InundationScreen(viewModel = viewModel)
            }
            composable(Screen.Nwp.route) {
                NwpModelScreen(viewModel = viewModel)
            }
            composable(Screen.Emergency.route) {
                EmergencyResponseScreen(viewModel = viewModel)
            }
            composable(Screen.AiScientist.route) {
                AiScientistScreen(viewModel = viewModel)
            }
            composable(Screen.Auth.route) {
                AuthScreen(viewModel = viewModel)
            }
        }
    }
}
