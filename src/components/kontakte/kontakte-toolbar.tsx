"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { ImportDialog } from "./import-dialog";

export function KontakteToolbar() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
        <Link href="/kontakte/neu">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Neuer Kontakt
          </Button>
        </Link>
      </div>

      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
    </>
  );
}
