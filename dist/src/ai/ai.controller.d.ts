import { AiService } from './ai.service';
import { ExtractRequestDto } from './dto/extract-request.dto';
export declare class AiController {
    private readonly ai;
    constructor(ai: AiService);
    extract(dto: ExtractRequestDto): Promise<import("./dto/extraction-result.dto").AppointmentExtractionResultDto>;
}
