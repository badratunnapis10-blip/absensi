import { NextResponse } from "next/server"; import { createClient } from "@/lib/supabase/server";
/**
 * Starter endpoint. In production, verify session token on the server, use DB transaction/RPC,
 * calculate distance server-side, validate upload ownership, and rely on UNIQUE(session_id, mahasiswa_id).
 */
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
 const {data:profile}=await supabase.from("users").select("role").eq("id",user.id).single();
 if(profile?.role!=="mahasiswa")return NextResponse.json({error:"Forbidden"},{status:403});
 const body=await req.json().catch(()=>null);
 if(!body?.sessionId||!body?.qrToken||typeof body?.latitude!=="number"||typeof body?.longitude!=="number")return NextResponse.json({error:"Data presensi tidak lengkap"},{status:400});
 // Jangan percaya timestamp, role, student ID, status, atau koordinat yang dikirim client tanpa validasi.
 const {data,error}=await supabase.rpc("submit_attendance",{p_session_id:body.sessionId,p_qr_token:body.qrToken,p_latitude:body.latitude,p_longitude:body.longitude,p_selfie_path:body.selfiePath??null});
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,data});
}