export declare class ExtractedRequirementItemDto {
    description: string;
}
export declare class AppointmentExtractionResultDto {
    title?: string;
    dateTime?: string;
    location?: string;
    notes?: string;
    requirements?: ExtractedRequirementItemDto[];
}
