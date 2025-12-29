import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

// GET - Serve PDF files from Supabase Storage
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { path: pathArray } = await params
    const fileName = pathArray[pathArray.length - 1]
    const paperNo = pathArray[0]
    
    // Construct storage path: outgoing/BON-OC-001/filename.pdf
    const storagePath = `outgoing/${paperNo}/${fileName}`
    
    // Download file from Supabase Storage
    const fileBuffer = await downloadPdfFromStorage(storagePath)
    
    if (!fileBuffer) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }
    
    // Convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json(
      { error: "Could not serve file" },
      { status: 500 }
    )
  }
}

