package com.meghdrishti.ai.util

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.tasks.await

/**
 * Authentication helper for Google Sign-In via Credential Manager
 * and Firebase Authentication.
 */
class AuthHelper(private val context: Context) {

    private val credentialManager = CredentialManager.create(context)

    private val auth: FirebaseAuth? by lazy {
        try {
            FirebaseAuth.getInstance()
        } catch (_: Exception) { null }
    }

    /**
     * Check if user is currently signed in.
     */
    fun getCurrentUser(): FirebaseUser? {
        return try {
            auth?.currentUser
        } catch (_: Exception) { null }
    }

    /**
     * Attempt Google Sign-In using Credential Manager.
     */
    suspend fun signInWithGoogle(webClientId: String): Result<FirebaseUser> {
        return try {
            val signInOption = GetSignInWithGoogleOption.Builder(webClientId)
                .build()

            val request = GetCredentialRequest.Builder()
                .addCredentialOption(signInOption)
                .build()

            val result: GetCredentialResponse = credentialManager.getCredential(
                request = request,
                context = context as android.app.Activity
            )

            val googleIdToken = GoogleIdTokenCredential
                .createFrom(result.credential.data)
                .idToken

            val firebaseCredential = GoogleAuthProvider.getCredential(googleIdToken, null)
            val authResult = auth?.signInWithCredential(firebaseCredential)?.await()
            val user = authResult?.user

            if (user != null) {
                Result.success(user)
            } else {
                Result.failure(Exception("Firebase authentication returned null user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Sign out from both Firebase and Credential Manager.
     */
    suspend fun signOut() {
        try {
            auth?.signOut()
            credentialManager.clearCredentialState(
                androidx.credentials.ClearCredentialStateRequest()
            )
        } catch (_: Exception) { }
    }
}
