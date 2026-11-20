// DRF read-model contracts. Identity is selected by the server, never by these DTOs.
export type CatalogueRow = {id:string;slug:string;name:string;category:string;description:string|null;address:string|null;logo_url?:string;vip_purchase_threshold:number;at_risk_days:number;inactive_days:number};
type MembershipRow={business_id:string;points_balance:number;tier:string};
type ActivityRow={business_id:string;event_type:string;created_at:string};
type PreviewRow={business_id:string;name:string;created_at:string};
type Dates={starts_at?:string|null;ends_at?:string|null};
type Audience={audience_segment?:string|null};
export type DiscoveryData={catalog:CatalogueRow[];memberships:MembershipRow[];activity:ActivityRow[];rewards:PreviewRow[];campaigns:(PreviewRow & Dates)[]};
export type DiscoveryDetail={stamps:{current_stamps:number;required_stamps:number;reward_name:string}|null;
rewards:({id:string;name:string;description?:string|null;points_required:number;type:'discount'|'points'|'credit'|'product'} & Audience)[];
campaigns:({id:string;name:string;description?:string|null;status:string;type:'discount_redeem'|'points_boost';discount_percent:number|null;reward_points:number} & Dates & Audience)[];
missions:({id:string;name:string;description?:string|null;goal:number;reward_points:number} & Dates & Audience)[];
progress:{mission_id:string;progress:number;completed_at:string|null}[]};
