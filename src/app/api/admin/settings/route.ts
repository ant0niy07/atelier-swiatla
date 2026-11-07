import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';
const schema=z.object({key:z.enum(['store_contact','store_operations']),value:z.object({}).passthrough()});
export async function POST(request:Request){let db;try{({client:db}=await requireAdminService())}catch{return NextResponse.json({error:'FORBIDDEN'},{status:403})}const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'INVALID_SETTINGS'},{status:400});const {error}=await db.from('store_settings').upsert(parsed.data,{onConflict:'key'});return error?NextResponse.json({error:'SAVE_FAILED'},{status:400}):NextResponse.json({ok:true})}
