"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const query_service_1 = require("./query.service");
const answer_question_dto_1 = require("./dto/answer-question.dto");
let QueryController = class QueryController {
    query;
    constructor(query) {
        this.query = query;
    }
    answer(dto) {
        return this.query
            .answerQuestion(dto.question)
            .then((answer) => ({ answer }));
    }
};
exports.QueryController = QueryController;
__decorate([
    (0, common_1.Post)('answer'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [answer_question_dto_1.AnswerQuestionDto]),
    __metadata("design:returntype", void 0)
], QueryController.prototype, "answer", null);
exports.QueryController = QueryController = __decorate([
    (0, common_1.Controller)('query'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [query_service_1.QueryService])
], QueryController);
//# sourceMappingURL=query.controller.js.map