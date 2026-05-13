import { ConfigService } from '@nestjs/config';
export declare class AiService {
    private readonly config;
    private readonly client;
    private readonly model;
    constructor(config: ConfigService);
    private ensureClient;
    extractAppointmentFromText(text: string): Promise<import("./dto/extraction-result.dto").AppointmentExtractionResultDto>;
    answerQuestionFromFacts(question: string, factsJson: string): Promise<string>;
}
