package com.buildskills.jobreadytracker

/**
 * Pure helpers for <input type="file" accept="..."> handling.
 * They map the web `accept` list to MIME types for the system document picker and re-check
 * whatever the user actually picked, because providers often report CSV/XLSX inconsistently.
 */
internal object TrackerUploads {
    private const val OCTET_STREAM = "application/octet-stream"

    private val extensionMimeTypes = mapOf(
        "csv" to listOf("text/csv", "text/comma-separated-values", "application/csv", "application/vnd.ms-excel"),
        "xlsx" to listOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "xls" to listOf("application/vnd.ms-excel"),
        "pdf" to listOf("application/pdf"),
        "png" to listOf("image/png"),
        "jpg" to listOf("image/jpeg"),
        "jpeg" to listOf("image/jpeg"),
        "gif" to listOf("image/gif"),
        "webp" to listOf("image/webp"),
        "txt" to listOf("text/plain"),
        "json" to listOf("application/json"),
    )

    /** Splits comma-separated entries, lowercases, and drops blanks and duplicates. */
    fun normalize(acceptTypes: Array<String>?): List<String> = acceptTypes.orEmpty()
        .flatMap { it.split(',') }
        .map { it.trim().lowercase() }
        .filter { it.isNotEmpty() }
        .distinct()

    /** MIME types to offer the system picker. No (or wildcard) accept list means any file. */
    fun pickerMimeTypes(accept: List<String>): Array<String> {
        if (accept.isEmpty() || "*/*" in accept) return arrayOf("*/*")
        val types = linkedSetOf<String>()
        var hasExtension = false
        for (token in accept) {
            if (token.startsWith(".")) {
                hasExtension = true
                extensionMimeTypes[token.drop(1)]?.let { types += it }
            } else if (token.contains('/')) {
                types += token
            }
        }
        // Extension-only filters: some providers label such files application/octet-stream.
        if (hasExtension) types += OCTET_STREAM
        return if (types.isEmpty()) arrayOf("*/*") else types.toTypedArray()
    }

    /** Re-checks a picked file's reported MIME type and display name against the web `accept` list. */
    fun matches(accept: List<String>, mimeType: String?, fileName: String?): Boolean {
        if (accept.isEmpty() || "*/*" in accept) return true
        val mime = mimeType?.lowercase()
        val ext = fileName?.substringAfterLast('.', "")?.lowercase().orEmpty()
        val mimesForExt = extensionMimeTypes[ext].orEmpty()
        return accept.any { token ->
            when {
                token.startsWith(".") -> {
                    val wanted = token.drop(1)
                    ext == wanted || (mime != null && mime in extensionMimeTypes[wanted].orEmpty())
                }
                token.endsWith("/*") -> {
                    val prefix = token.dropLast(1)
                    (mime?.startsWith(prefix) == true) || mimesForExt.any { it.startsWith(prefix) }
                }
                token.contains('/') -> mime == token || token in mimesForExt
                else -> false
            }
        }
    }
}
