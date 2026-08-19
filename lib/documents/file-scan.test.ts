import { describe, expect, it } from "vitest";
import { canConfirmDocumentFile, isCleanUploadedFile } from "./file-scan";

describe("isCleanUploadedFile", () => {
  it("exige à la fois isUploaded et scanStatus CLEAN", () => {
    expect(isCleanUploadedFile({ isUploaded: true, scanStatus: "CLEAN" })).toBe(true);
    expect(isCleanUploadedFile({ isUploaded: true, scanStatus: "PENDING" })).toBe(false);
    expect(isCleanUploadedFile({ isUploaded: true, scanStatus: "SCANNING" })).toBe(false);
    expect(isCleanUploadedFile({ isUploaded: true, scanStatus: "REJECTED" })).toBe(false);
    expect(isCleanUploadedFile({ isUploaded: false, scanStatus: "CLEAN" })).toBe(false);
  });
});

describe("canConfirmDocumentFile", () => {
  it("limite la confirmation au propriétaire ou au SUPER_ADMIN", () => {
    expect(canConfirmDocumentFile({ id: "author", role: "USER" }, { authorId: "author" })).toBe(true);
    expect(canConfirmDocumentFile({ id: "other", role: "USER" }, { authorId: "author" })).toBe(false);
    expect(canConfirmDocumentFile({ id: "root", role: "SUPER_ADMIN" }, { authorId: "author" })).toBe(true);
  });
});
