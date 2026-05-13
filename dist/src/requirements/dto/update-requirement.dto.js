"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRequirementDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_requirement_dto_1 = require("./create-requirement.dto");
class UpdateRequirementDto extends (0, mapped_types_1.PartialType)(create_requirement_dto_1.CreateRequirementDto) {
}
exports.UpdateRequirementDto = UpdateRequirementDto;
//# sourceMappingURL=update-requirement.dto.js.map