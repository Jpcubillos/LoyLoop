"use server";
import { revalidatePath } from "next/cache";
import { backendBusiness, backendRequest } from "@/lib/backend/server";

export async function createBusinessUser(formData:FormData) {
  const business=await backendBusiness();
  const full_name=String(formData.get('full_name')??'').trim();
  const email=String(formData.get('email')??'').trim().toLowerCase();
  if(!full_name || !email) throw new Error('El nombre y correo son obligatorios.');
  await backendRequest(`/businesses/${business.id}/staff/`,'POST',{
    full_name,email,business_role:String(formData.get('business_role')??'cashier'),active:true,
  });
  revalidatePath('/dashboard/configuracion');
}

export async function updateAppUserRole(formData:FormData) {
  const business=await backendBusiness();
  const id=String(formData.get('id')??'');
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Registro no valido.');
  if(formData.get('account_type')!=='business') throw new Error('La conversion de cuentas requiere revision de soporte.');
  await backendRequest(`/businesses/${business.id}/staff/${id}/`,'PATCH',{
    business_role:String(formData.get('business_role')??''),active:formData.get('active')==='on',
  });
  revalidatePath('/dashboard/configuracion');
}

export async function updateBusinessSegmentationRules(formData:FormData) {
  const business=await backendBusiness();
  const values=Object.fromEntries(['vip_purchase_threshold','at_risk_days','inactive_days'].map(name=>[name,Number(formData.get(name))]));
  if(Object.values(values).some(value=>!Number.isInteger(value)||value<1)||values.inactive_days<=values.at_risk_days) throw new Error('Revisa los umbrales y dias del formulario.');
  await backendRequest(`/businesses/${business.id}/segmentation/`,'PATCH',values);
  revalidatePath('/dashboard/configuracion');
}
