package com.example.data

import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object SecurityUtils {
    private const val ITERATIONS = 100_000
    private const val KEY_LENGTH_BITS = 256
    private const val SALT_BYTES = 16
    private val random = SecureRandom()

    val USERNAME_REGEX = Regex("^[a-z0-9._-]{3,24}$")
    val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")

    fun normalizeUsername(raw: String): String = raw.trim().lowercase()

    fun isValidEmail(email: String): Boolean =
        email.length in 5..120 && EMAIL_REGEX.matches(email)

    fun isValidLoginIdentifier(value: String): Boolean =
        isValidEmail(value) || USERNAME_REGEX.matches(value)

    fun isValidUsername(username: String): Boolean = isValidEmail(username)

    fun formatDisplayIdentifier(value: String): String =
        if (value.contains("@")) value else "@$value"

    fun hashPassword(password: String): String {
        val salt = ByteArray(SALT_BYTES)
        random.nextBytes(salt)
        val derived = pbkdf2(password.toCharArray(), salt)
        val saltB64 = Base64.encodeToString(salt, Base64.NO_WRAP)
        val hashB64 = Base64.encodeToString(derived, Base64.NO_WRAP)
        return "$saltB64:$hashB64"
    }

    fun verifyPassword(password: String, storedHash: String): Boolean {
        val parts = storedHash.split(":")
        if (parts.size != 2) return false
        return try {
            val salt = Base64.decode(parts[0], Base64.NO_WRAP)
            val expectedHash = Base64.decode(parts[1], Base64.NO_WRAP)
            val actualHash = pbkdf2(password.toCharArray(), salt)
            MessageDigest.isEqual(expectedHash, actualHash)
        } catch (_: IllegalArgumentException) {
            false
        }
    }

    fun generateSessionToken(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    private fun pbkdf2(password: CharArray, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(password, salt, ITERATIONS, KEY_LENGTH_BITS)
        return try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }
}
