export function formatFamilyNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 9999) {
    throw new RangeError("Family number sequence must be between 0 and 9999.");
  }
  return `PK-FAM-${String(sequence).padStart(4, "0")}`;
}

export function formatMemberNumber(familySequence: number, memberIndex: number): string {
  if (!Number.isInteger(memberIndex) || memberIndex < 1 || memberIndex > 9) {
    throw new RangeError("A family can have between 1 and 9 numbered members.");
  }
  return `PK-${String(familySequence).padStart(4, "0")}${memberIndex}`;
}
