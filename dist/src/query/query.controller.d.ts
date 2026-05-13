import { QueryService } from './query.service';
import { AnswerQuestionDto } from './dto/answer-question.dto';
export declare class QueryController {
    private readonly query;
    constructor(query: QueryService);
    answer(dto: AnswerQuestionDto): Promise<{
        answer: string;
    }>;
}
