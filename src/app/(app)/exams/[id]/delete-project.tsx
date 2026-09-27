"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteProject } from "../actions";

export function DeleteProjectButton({ projectId, title }: { projectId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="sm" className="text-muted">
          <Trash2 /> Ta bort provet
        </Button>
      }
      title={`Ta bort ”${title}”?`}
      description="Allt underlag, planen och dina resultat för provet tas bort. Det går inte att ångra."
    >
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
        <Button variant="danger" loading={pending} onClick={() => start(() => deleteProject(projectId))}>
          Ta bort
        </Button>
      </div>
    </Modal>
  );
}
