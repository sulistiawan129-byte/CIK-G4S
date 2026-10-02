"use client";
import { createContext, useContext } from "react";
import { useApp } from "@/components/AppContext";
import { gcCanEdit, gcCanInput } from "@/lib/access";

/** Izin di modul G-C: edit = ubah/hapus/master data; input = catat NC & total pemeriksaan. SHE: lihat + unduh/cetak. */
interface Perm { edit: boolean; input: boolean; readOnly: boolean }
const Ctx = createContext<Perm>({ edit: false, input: false, readOnly: true });
export function GcPermProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useApp();
  const edit = gcCanEdit(profile.role), input = gcCanInput(profile.role);
  return <Ctx.Provider value={{ edit, input, readOnly: !edit && !input }}>{children}</Ctx.Provider>;
}
export const useGcPerm = () => useContext(Ctx);
