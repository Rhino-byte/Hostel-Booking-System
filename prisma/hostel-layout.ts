import { BathroomType, RoomConfig } from "@prisma/client";

export type ResidenceDef = {
  code: string;
  label: string;
  feeKes: number;
  depositKes: number;
  bathroom: BathroomType;
  config: RoomConfig;
  sortOrder: number;
  features: string;
};

export type BlockDef = {
  code: string;
  name: string;
  residence: string;
  rooms: number;
  bedsPer: number;
};

export const RESIDENCE_DEFS: ResidenceDef[] = [
  {
    code: "SC",
    label: "Self-Contained",
    feeKes: 75000,
    depositKes: 37500,
    bathroom: BathroomType.PRIVATE,
    config: RoomConfig.PRIVATE_SINGLE,
    sortOrder: 1,
    features:
      "Private self-contained room with lockable wardrobe, bed, mattress, study table, chair, sink, mirror, TV/common room access",
  },
  {
    code: "B",
    label: "Residence B",
    feeKes: 65000,
    depositKes: 32500,
    bathroom: BathroomType.SHARED,
    config: RoomConfig.PRIVATE_SINGLE,
    sortOrder: 2,
    features:
      "Private single room with lockable wardrobe, bed, mattress, study table, chair; hot & cold water; shared bathrooms; study/common/TV room",
  },
  {
    code: "C",
    label: "Residence C",
    feeKes: 57000,
    depositKes: 28500,
    bathroom: BathroomType.SHARED,
    config: RoomConfig.SHARED_SINGLE,
    sortOrder: 3,
    features:
      "Shared room with single beds, lockable double wardrobes, study tables and chairs; shared bathrooms; study/TV room",
  },
  {
    code: "A",
    label: "Residence A",
    feeKes: 50000,
    depositKes: 25000,
    bathroom: BathroomType.SHARED,
    config: RoomConfig.SHARED_BUNK,
    sortOrder: 4,
    features:
      "Shared room with double-decker bunk beds, lockable wardrobes, study tables and chairs; shared bathrooms; study/TV room",
  },
  {
    code: "CL",
    label: "Common / Launch",
    feeKes: 47000,
    depositKes: 23500,
    bathroom: BathroomType.SHARED,
    config: RoomConfig.SHARED_BUNK,
    sortOrder: 5,
    features:
      "Shared double-decker bunk rooms in Common Rooms and Launch upstairs; lockable wardrobes; shared bathrooms",
  },
];

export const BLOCK_DEFS: BlockDef[] = [
  { code: "A", name: "Residence A", residence: "A", rooms: 19, bedsPer: 2 },
  { code: "B", name: "Residence B", residence: "B", rooms: 50, bedsPer: 1 },
  { code: "C", name: "Residence C", residence: "C", rooms: 37, bedsPer: 2 },
  { code: "SC", name: "Self-Contained", residence: "SC", rooms: 5, bedsPer: 1 },
  { code: "CM", name: "Common Rooms", residence: "CL", rooms: 3, bedsPer: 2 },
  { code: "LU", name: "Launch Upstairs", residence: "CL", rooms: 6, bedsPer: 2 },
];
