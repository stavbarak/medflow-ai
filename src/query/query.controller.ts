import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QueryService } from './query.service';
import { AnswerQuestionDto } from './dto/answer-question.dto';

@Controller('query')
@UseGuards(AuthGuard('jwt'))
export class QueryController {
  constructor(private readonly query: QueryService) {}

  @Post('answer')
  answer(@Body() dto: AnswerQuestionDto) {
    return this.query
      .answerQuestion(dto.question)
      .then((answer) => ({ answer }));
  }
}
