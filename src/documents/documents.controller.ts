import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller('documents')
@UseGuards(AuthGuard('jwt'))
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user.id, dto);
  }

  @Get()
  findAll() {
    return this.documents.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }
}
