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

export async function updateBusinessProfile(formData:FormData) {
  const business=await backendBusiness();
  const name=String(formData.get('name')??'').trim();
  const category=String(formData.get('category')??'').trim();
  const address=String(formData.get('address')??'').trim();
  const city=String(formData.get('city')??'').trim();
  const description=String(formData.get('description')??'').trim();

  if(!name) throw new Error('El nombre del comercio es obligatorio.');
  if(!category) throw new Error('La categoria es obligatoria.');

  await backendRequest(`/businesses/${business.id}/`,'PATCH',{
    name,
    category,
    address:address||null,
    city:city||null,
    description:description||null,
  });
  revalidatePath('/dashboard/configuracion');
  revalidatePath('/dashboard');
}

export async function updateBusinessAwardRules(formData: FormData) {
  const business = await backendBusiness();
  const pointsPerPurchase = Number(formData.get("points_per_purchase") ?? 10);
  const stampsPerPurchase = Number(formData.get("stamps_per_purchase") ?? 1);
  const stampsEnabled = formData.get("stamps_enabled") === "on" || formData.get("stamps_enabled") === "true";
  const minPurchaseCents = Number(formData.get("min_purchase_cents") ?? 0);

  if (!Number.isInteger(pointsPerPurchase) || pointsPerPurchase < 0) {
    throw new Error("Los puntos por compra deben ser un número entero mayor o igual a 0.");
  }
  if (!Number.isInteger(stampsPerPurchase) || stampsPerPurchase < 0) {
    throw new Error("Los sellos por compra deben ser un número entero mayor o igual a 0.");
  }

  await backendRequest(`/businesses/${business.id}/award-rules/`, "PUT", {
    pointsPerPurchase,
    stampsPerPurchase,
    stampsEnabled,
    minPurchaseCents,
  });
  revalidatePath("/dashboard/configuracion");
}

export async function joinBusinessAction(businessId: string) {
  if (!businessId || !/^[0-9a-fA-F-]{36}$/.test(businessId)) {
    throw new Error("Identificador de comercio no válido.");
  }
  const result = await backendRequest<{ id: string }>(`/memberships/${businessId}/`, "POST", {});
  revalidatePath("/c");
  revalidatePath("/c/comercios");
  return { ok: true, membershipId: result.id };
}


