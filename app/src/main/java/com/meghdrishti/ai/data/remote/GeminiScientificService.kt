package com.meghdrishti.ai.data.remote

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import com.meghdrishti.ai.BuildConfig

/**
 * Gemini-based meteorological scenario analysis for the MeghDrishti demo app.
 *
 * Generates non-official analysis from supplied observations and scenario data.
 */
class GeminiScientificService {

    private val model: GenerativeModel? = try {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isNotBlank()) {
            GenerativeModel(
                modelName = "gemini-2.0-flash",
                apiKey = apiKey,
                generationConfig = generationConfig {
                    temperature = 0.3f
                    topP = 0.85f
                    maxOutputTokens = 4096
                }
            )
        } else null
    } catch (_: Exception) {
        null
    }

    /**
    * Keep generated analysis distinct from official agency warnings.
     */
    private val systemPrompt = """
You are a meteorological analysis assistant in an independent demonstration application.
You are not affiliated with or authorized to speak for ISRO, IMD, NCMRWF, CWC, or any government agency.

Your role:
1. Analyze the supplied meteorological data and scenario assumptions only.
2. Inputs may be simulated, incomplete, stale, or from third-party sources. Never describe them as verified live agency feeds unless explicitly identified as such in the input.
3. Provide a concise technical scenario assessment, including:
   - Upper-air trough/ridge analysis (500 hPa, 200 hPa)
   - Low-Level Jet (LLJ) moisture transport pathways
   - Mesoscale Convective System (MCS) lifecycle assessment
   - Quantitative Precipitation Forecast (QPF) with uncertainty bounds
4. Clearly identify missing inputs and uncertainty; do not invent observations or synoptic features.
5. Do not issue official warnings, evacuation instructions, or orders to response agencies.
6. Tell readers to consult current official IMD and local emergency-service guidance for decisions.

Format the output as a non-official scenario assessment with:
- INPUTS AND PROVENANCE
- TECHNICAL ASSESSMENT
- UNCERTAINTY AND DATA GAPS
- NON-OFFICIAL RISK INDICATION
- OFFICIAL GUIDANCE REMINDER
""".trimIndent()

    /**
    * Generate non-official analysis based on supplied context.
     */
    suspend fun generateAdvisory(observationContext: String): String {
        val genModel = model ?: return generateOfflineAdvisory(observationContext)

        return try {
            val response = genModel.generateContent(
                content {
                    text(systemPrompt)
                    text("\n\nSUPPLIED DATA AND SCENARIO CONTEXT:\n$observationContext\n\n" +
                        "Generate a clearly labeled, non-official scenario assessment. State that values may be simulated, identify uncertainty and missing inputs, and do not issue warnings, evacuation instructions, or agency orders.")
                }
            )
            response.text ?: generateOfflineAdvisory(observationContext)
        } catch (e: Exception) {
            generateOfflineAdvisory(observationContext, error = e.message)
        }
    }

    /**
    * Generate a non-official flash flood scenario analysis.
     */
    suspend fun generateFlashFloodBulletin(
        location: String,
        rainfallData: String,
        inundationData: String
    ): String {
        val genModel = model ?: return generateOfflineFloodBulletin(location)

        return try {
            val response = genModel.generateContent(
                content {
                    text(systemPrompt)
                    text("""
                        
FLASH FLOOD SCENARIO ANALYSIS REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCATION: $location
RAINFALL DATA: $rainfallData
INUNDATION MODEL: $inundationData

Generate a clearly labeled, non-official scenario assessment with:
1. A concise hydrological interpretation of the supplied values
2. Explicit uncertainty and data limitations
3. No invented inundation coordinates or agency orders
4. A reminder to consult current official warnings and local emergency services
                    """.trimIndent())
                }
            )
            response.text ?: generateOfflineFloodBulletin(location)
        } catch (e: Exception) {
            generateOfflineFloodBulletin(location, error = e.message)
        }
    }

    /**
     * Offline fallback advisory when Gemini API is unavailable.
     */
    private fun generateOfflineAdvisory(context: String, error: String? = null): String {
        return buildString {
            appendLine("MEGHDRISHTI AI - NON-OFFICIAL SCENARIO ANALYSIS")
            appendLine("DEMO OUTPUT - NOT AN IMD/ISRO BULLETIN OR PUBLIC WARNING")
            appendLine()
            appendLine("STATUS: OFFLINE FALLBACK")
            if (error != null) appendLine("NOTE: $error")
            appendLine()
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine("No generated meteorological analysis is available while the AI service is offline.")
            appendLine()
            appendLine("OBSERVATIONAL CONTEXT PROVIDED:")
            appendLine(context.take(500))
            appendLine()
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine("For decisions, consult current official IMD and local emergency-service guidance.")
            appendLine("Connect Gemini API to enable non-official scenario analysis.")
            appendLine("Set GEMINI_API_KEY in the build environment or as a Gradle project property.")
        }
    }

    private fun generateOfflineFloodBulletin(location: String, error: String? = null): String {
        return buildString {
            appendLine("MEGHDRISHTI AI - NON-OFFICIAL FLOOD SCENARIO")
            appendLine("DEMO OUTPUT - NOT AN IMD/CWC BULLETIN OR PUBLIC WARNING")
            appendLine()
            appendLine("LOCATION: $location")
            appendLine("STATUS: OFFLINE MODE")
            if (error != null) appendLine("ERROR: $error")
            appendLine()
            appendLine("No flood analysis is available while the AI service is offline.")
            appendLine("For decisions, consult current official CWC, IMD, and local emergency-service guidance.")
        }
    }
}
