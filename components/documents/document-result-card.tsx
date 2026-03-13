"use client";

import type { AnalyzedDocument } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Calendar,
  MapPin,
  Building2,
  User,
  Hash,
  Clock,
} from "lucide-react";

const DOC_TYPE_STYLES: Record<string, string> = {
  rfq: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  rfi: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pws: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  special_notice:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  rfq: "RFQ",
  rfi: "RFI",
  pws: "PWS",
  special_notice: "Special Notice",
  other: "Other",
};

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <ul className="list-disc list-inside space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentResultCard({ doc }: { doc: AnalyzedDocument }) {
  const typeStyle = DOC_TYPE_STYLES[doc.document_type] || DOC_TYPE_STYLES.other;
  const typeLabel = DOC_TYPE_LABELS[doc.document_type] || doc.document_type;

  const hasDetails =
    doc.issuing_organization ||
    doc.buyer_or_poc ||
    doc.solicitation_or_tracking_number ||
    doc.contract_type ||
    doc.location ||
    doc.period_of_performance;

  const hasDates =
    doc.issue_date ||
    doc.response_due_date ||
    (doc.event_dates && doc.event_dates.length > 0);

  const hasPeopleOrOrgs =
    (doc.important_people && doc.important_people.length > 0) ||
    (doc.important_organizations && doc.important_organizations.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg leading-snug">
              {doc.title}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge className={`border-0 ${typeStyle}`}>{typeLabel}</Badge>
              {doc.file_name && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {doc.file_name}
                </span>
              )}
              <span>
                {new Date(doc.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div>
          <h4 className="text-sm font-medium mb-1">Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {doc.summary}
          </p>
        </div>

        {/* Key Details */}
        {hasDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailItem
              icon={Building2}
              label="Issuing Organization"
              value={doc.issuing_organization}
            />
            <DetailItem
              icon={User}
              label="Buyer / POC"
              value={doc.buyer_or_poc}
            />
            <DetailItem
              icon={Hash}
              label="Solicitation / Tracking #"
              value={doc.solicitation_or_tracking_number}
            />
            <DetailItem
              icon={FileText}
              label="Contract Type"
              value={doc.contract_type}
            />
            <DetailItem icon={MapPin} label="Location" value={doc.location} />
            <DetailItem
              icon={Clock}
              label="Period of Performance"
              value={doc.period_of_performance}
            />
          </div>
        )}

        {/* Dates */}
        {hasDates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailItem
              icon={Calendar}
              label="Issue Date"
              value={doc.issue_date}
            />
            <DetailItem
              icon={Calendar}
              label="Response Due Date"
              value={doc.response_due_date}
            />
            {doc.event_dates && doc.event_dates.length > 0 && (
              <div className="sm:col-span-2">
                <h4 className="text-xs text-muted-foreground mb-1">
                  Event Dates
                </h4>
                <div className="flex flex-wrap gap-1">
                  {doc.event_dates.map((date, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {date}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Requirements */}
        <ListSection title="Key Requirements" items={doc.key_requirements} />
        <ListSection
          title="Submission Requirements"
          items={doc.submission_requirements}
        />

        {/* People & Organizations */}
        {hasPeopleOrOrgs && (
          <div className="space-y-2">
            {doc.important_people && doc.important_people.length > 0 && (
              <div>
                <h4 className="text-xs text-muted-foreground mb-1">
                  Key People
                </h4>
                <div className="flex flex-wrap gap-1">
                  {doc.important_people.map((person, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {person}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {doc.important_organizations &&
              doc.important_organizations.length > 0 && (
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">
                    Key Organizations
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {doc.important_organizations.map((org, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {org}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
