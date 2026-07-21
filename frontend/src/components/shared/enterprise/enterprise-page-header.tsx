"use client";

import { HelpCircle, Star } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

export interface BreadcrumbEntry {
  label: string;
  onClick?: () => void;
}

export interface EnterprisePageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbEntry[];
  actions?: React.ReactNode;
  onHelp?: () => void;
  favorite?: { active: boolean; onToggle: () => void };
  className?: string;
}

export function EnterprisePageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  actions,
  onHelp,
  favorite,
  className,
}: EnterprisePageHeaderProps) {
  const trailing = (
    <>
      {onHelp && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onHelp} aria-label="Help">
                <HelpCircle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {favorite && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={favorite.onToggle}
          aria-label={favorite.active ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={cn("w-4 h-4", favorite.active && "fill-amber-400 text-amber-400")} />
        </Button>
      )}
      {actions}
    </>
  );

  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.label}-${i}`} className="contents">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : crumb.onClick ? (
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={crumb.onClick} className="hover:underline">
                          {crumb.label}
                        </button>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <PageHeader title={title} subtitle={subtitle} eyebrow={eyebrow} action={trailing} />
    </div>
  );
}
