/**
 * FilePicker-based file/folder operations for saving generated images.
 * Handles v12 (global FilePicker) and v13 (namespaced) transparently.
 */

/**
 * Return the FilePicker class, handling v12 (global) vs v13 (namespaced).
 * In v13 the global is deprecated; the real class is at
 * foundry.applications.apps.FilePicker.implementation.
 * @returns {typeof FilePicker} the appropriate FilePicker class
 */
function getFilePicker() {
  if (typeof foundry !== "undefined" &&
      foundry.applications?.apps?.FilePicker?.implementation) {
    return foundry.applications.apps.FilePicker.implementation;
  }
  return FilePicker;
}

/**
 * Ensure a folder exists at the given path, creating it if necessary.
 * Swallows "already exists" (EEXIST) errors; re-throws anything else.
 * @param {string} folderPath — the data-relative folder path to create
 * @returns {Promise<void>}
 * @throws {Error} if folder creation fails for a reason other than already existing
 */
export async function ensureFolder(folderPath) {
  if (!folderPath || typeof folderPath !== "string") return;

  const FP = getFilePicker();
  try {
    await FP.createDirectory("data", folderPath);
  } catch (err) {
    const msg = (err?.message || String(err)).toLowerCase();
    if (msg.includes("eexist") || msg.includes("already exist")) {
      // folder already exists — no action needed
    } else {
      console.error("Unexpected error creating folder:", folderPath, err);
      throw err;
    }
  }
}

/**
 * Convert a data URL to a local file and save it via FilePicker.upload.
 * @param {string} dataUrl — base64-encoded data URL (e.g. "data:image/png;base64,...")
 * @param {string} fileName — target file name (e.g. "sword_12345.png")
 * @param {string} targetFolder — data-relative folder path to upload into
 * @returns {Promise<string|null>} the saved file path, or null on failure
 */
export async function saveImageLocally(dataUrl, fileName, targetFolder) {
  if (!dataUrl || !fileName || !targetFolder) return null;

  const FP = getFilePicker();
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: blob.type });
  try {
    const upload = await FP.upload("data", targetFolder, file, { notify: false });
    return upload.path;
  } catch (err) {
    console.error("Error saving image locally:", err);
    return null;
  }
}
