"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAppointmentExtraction = validateAppointmentExtraction;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const extraction_result_dto_1 = require("./dto/extraction-result.dto");
function validateAppointmentExtraction(raw) {
    const obj = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
    const dto = (0, class_transformer_1.plainToInstance)(extraction_result_dto_1.AppointmentExtractionResultDto, obj);
    const errors = (0, class_validator_1.validateSync)(dto, {
        whitelist: true,
        forbidUnknownValues: false,
    });
    if (errors.length > 0) {
        const msg = errors
            .map((e) => Object.values(e.constraints ?? {}).join(', '))
            .join('; ');
        throw new Error(msg || 'אימות נתוני חילוץ נכשל');
    }
    return dto;
}
//# sourceMappingURL=ai-validation.js.map