"use client";

import { SourceType, getSourceConfig } from "@/lib/sources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Filter } from "lucide-react";

interface SourceDropdownProps {
  selectedSources: SourceType[];
  onSourceToggle: (source: SourceType) => void;
}

const allSources: SourceType[] = ["github", "huggingface", "gitlab", "npm", "pypi"];

export function SourceDropdown({ selectedSources, onSourceToggle }: SourceDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-slate-800/30 border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/50 transition-all duration-200 gap-2 h-9"
        >
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 text-sm">Sources ({selectedSources.length})</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-56 border-slate-700/50 bg-slate-900/98 backdrop-blur-xl"
        align="center"
      >
        <DropdownMenuLabel className="text-slate-500 text-xs">
          Search Sources
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800/50" />
        {allSources.map((source) => {
          const config = getSourceConfig(source);
          const isSelected = selectedSources.includes(source);
          
          return (
            <DropdownMenuCheckboxItem
              key={source}
              checked={isSelected}
              onCheckedChange={() => onSourceToggle(source)}
              className="cursor-pointer hover:bg-slate-800/50 focus:bg-slate-800/50 py-2"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm">{config.icon}</span>
                <span className="text-sm text-slate-300">{config.name}</span>
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator className="bg-slate-800/50" />
        <div className="px-2 py-1.5 text-xs text-slate-600">
          {selectedSources.length === 0 ? (
            <span className="text-slate-500">Select at least one</span>
          ) : (
            <span>{selectedSources.length} selected</span>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

