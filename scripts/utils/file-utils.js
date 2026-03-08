/**
 * FilePicker-based file/folder operations for saving generated images.
 * Handles v12 (global FilePicker) and v13 (namespaced) transparently.
 */

/**
 * Return the FilePicker class, handling v12 (global) vs v13 (namespaced).
 * In v13 the global is deprecated; the real class is at
 * foundry.applications.apps.FilePicker.implementation.
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
 */
export async function ensureFolder(folderPath) {
  const FP = getFilePicker();
  try {
    await FP.createDirectory("data", folderPath);
    console.log("Created folder:", folderPath);
  } catch (err) {
    const msg = (err?.message || String(err)).toLowerCase();
    if (msg.includes("eexist") || msg.includes("already exist")) {
      console.log("Folder already exists:", folderPath);
    } else {
      console.error("Unexpected error creating folder:", folderPath, err);
      throw err;
    }
  }
}

export async function saveImageLocally(dataUrl, fileName, targetFolder) {
  const FP = getFilePicker();
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: blob.type });
  try {
    const upload = await FP.upload("data", targetFolder, file, { notify: false });
    console.log("Saved image locally:", upload);
    return upload.path;
  } catch (err) {
    console.error("Error saving image locally:", err);
    return "";
  }
}
