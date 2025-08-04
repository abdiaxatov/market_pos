interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export async function uploadToGitHub(file: File, fileName: string, folder = "models"): Promise<UploadResult> {
  try {
    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN
    const owner = process.env.NEXT_PUBLIC_GITHUB_OWNER || "abdiaxatov"
    const repo = process.env.NEXT_PUBLIC_GITHUB_REPO || "3d_menyu"
    const branch = "main"

    if (!token) {
      return { success: false, error: "GitHub token not configured" }
    }

    // Use FileReader to avoid stack overflow
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix (data:*/*;base64,)
        const base64 = result.split(",")[1]
        resolve(base64)
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })

    const path = `${folder}/${fileName}`
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Add ${folder}: ${fileName}`,
        content: base64Content,
        branch: branch,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData.message || "Upload failed" }
    }

    const downloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
    return { success: true, url: downloadUrl }
  } catch (error) {
    console.error("GitHub upload error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
