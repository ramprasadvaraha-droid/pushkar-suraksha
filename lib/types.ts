export const PHOTO_TYPES = ["face_front", "full_body", "side", "with_family"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number] | "dress_today";

export type Relation = "Father" | "Mother" | "Son" | "Daughter" | "Other";
export type Gender = "Male" | "Female" | "Other";

export interface MemberInput {
  name: string;
  age: number;
  relation: Relation;
  gender: Gender;
}

export interface MemberRecord extends MemberInput {
  id: string;
  member_number: string;
  status: "safe" | "missing" | "found";
  photos: Partial<Record<PhotoType, string>>;
}

export interface FamilyRecord {
  id: string;
  family_name: string;
  phone: string;
  district: string;
  family_number: string;
  members: MemberRecord[];
}

export interface VolunteerRecord {
  member_number: string;
  name: string;
  age: number;
  family_name: string;
  phone: string;
  photo_url: string | null;
  dress_photo_url: string | null;
  ghat: string | null;
  missing_at: string;
}
