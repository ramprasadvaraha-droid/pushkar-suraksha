import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import type { MemberInput } from "@/lib/types";

const relations = new Set(["Father", "Mother", "Son", "Daughter", "Other"]);
const genders = new Set(["Male", "Female", "Other"]);

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please try again.", 401);

  let body: {
    familyName?: string;
    phone?: string;
    district?: string;
    secret?: string;
    members?: MemberInput[];
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Family details could not be read.");
  }
  if (!body.familyName?.trim() || body.familyName.trim().length > 100 ||
      !body.district?.trim() || body.district.trim().length > 80 ||
      !body.phone || !/^[6-9]\d{9}$/.test(body.phone) ||
      !body.secret?.trim() || body.secret.trim().length < 3 || body.secret.trim().length > 120) {
    return apiError("Check the family name, 10-digit phone number, district, and verification secret.");
  }
  if (!Array.isArray(body.members) || body.members.length < 1 || body.members.length > 9) {
    return apiError("Add between 1 and 9 family members.");
  }
  for (let index = 0; index < body.members.length; index += 1) {
    const member = body.members[index];
    if (!member.name?.trim() || member.name.trim().length > 100 ||
        !Number.isInteger(member.age) || member.age < 0 || member.age > 120 ||
        !relations.has(member.relation) || !genders.has(member.gender)) {
      return apiError(`Check the name, age, relation, and gender for member ${index + 1}.`);
    }
  }

  const familyName = body.familyName.trim();
  const phone = body.phone;
  const district = body.district.trim();
  const secret = body.secret.trim();
  const members = body.members;
  try {
    const family = await withTransaction(async (client) => {
      await client.query("select pg_advisory_xact_lock($1)", [731842]);
      const { rows: [{ count }] } = await client.query<{ count: string }>(
        "select count(*)::text as count from public.families",
      );
      if (Number(count) >= 10000) throw new Error("Family numbers are currently exhausted.");

      let sequence = 842;
      if (Number(count) > 0) {
        let allocated = false;
        for (let attempt = 0; attempt < 10000; attempt += 1) {
          const candidate = randomInt(10000);
          const familyNumber = `PK-FAM-${String(candidate).padStart(4, "0")}`;
          const existing = await client.query(
            "select 1 from public.families where family_number = $1",
            [familyNumber],
          );
          if (existing.rowCount === 0) {
            sequence = candidate;
            allocated = true;
            break;
          }
        }
        if (!allocated) throw new Error("Could not allocate a unique family number.");
      }

      const familyNumber = `PK-FAM-${String(sequence).padStart(4, "0")}`;
      const { rows: [createdFamily] } = await client.query<{
        id: string;
        family_name: string;
        phone: string;
        district: string;
      }>(
        `insert into public.families (
           owner_id, family_name, phone, district, family_number, verification_secret_hash, verification_hint
         )
         values (
           $1, $2, $3, $4, $5,
           crypt(encode(digest(lower(trim($6)), 'sha256'), 'hex'), gen_salt('bf')),
           left(trim($6), 1) || '•••'
         )
         returning id, family_name, phone, district`,
        [user.id, familyName, phone, district, familyNumber, secret],
      );

      const createdMembers = [];
      for (let index = 0; index < members.length; index += 1) {
        const member = members[index];
        const memberNumber = `PK-${String(sequence).padStart(4, "0")}${index + 1}`;
        const { rows: [createdMember] } = await client.query<{
          id: string;
          name: string;
          age: number;
          relation: string;
          gender: string;
          member_number: string;
          status: "safe";
        }>(
          `insert into public.members (family_id, owner_id, name, age, relation, gender, member_number)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id, name, age, relation, gender, member_number, status`,
          [
            createdFamily.id, user.id, member.name.trim(), member.age,
            member.relation, member.gender, memberNumber,
          ],
        );
        createdMembers.push({ ...createdMember, photos: {} });
      }

      return { ...createdFamily, family_number: familyNumber, members: createdMembers };
    });
    return NextResponse.json({ family }, { status: 201 });
  } catch (error) {
    console.error("Family registration database operation failed.", error);
    return apiError(error instanceof Error ? error.message : "Family registration could not be completed.", 500);
  }
}
