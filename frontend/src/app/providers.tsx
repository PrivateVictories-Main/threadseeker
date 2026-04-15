"use client";

import { ReactNode } from "react";
import { UnifiedAIProvider } from "@/contexts/UnifiedAIContext";
import { EnhancedNavbar } from "@/components/EnhancedNavbar";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UnifiedAIProvider>
      <EnhancedNavbar />
      <main className="pt-16">
        {children}
      </main>
    </UnifiedAIProvider>
  );
}


