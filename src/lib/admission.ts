import { randomBytes } from "crypto";

/** Unique admission ID for name-only student intake (room assigned later via hostel map). */
export function newAdmissionNo(): string {
  return `STU-${randomBytes(5).toString("hex").toUpperCase()}`;
}
