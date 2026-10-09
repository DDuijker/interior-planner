import type { RoomType } from "@/core/model/types";

/** Soft floor tints per room type, used in the plan and the legend. */
export const ROOM_TINTS: Record<RoomType, string> = {
  living: "#E3EAE2",
  kitchen: "#EDE3CF",
  dining: "#EFE6D6",
  bed: "#E6E1EC",
  office: "#E2E6E9",
  bath: "#DCE9EC",
  toilet: "#DCE9EC",
  hal: "#ECE8DF",
  storage: "#E4E0D6",
  loggia: "#E9EDDF",
};
