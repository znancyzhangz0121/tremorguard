import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaseAnalysisDto } from './dto/case-analysis.dto';
import { ChatDto } from './dto/chat.dto';
import { AiService } from './ai.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    @Inject(AiService)
    private readonly aiService: AiService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Get AI assistant response' })
  chat(@Body() body: ChatDto) {
    return this.aiService.chat(body.message);
  }

  @Post('case-analysis')
  @ApiOperation({ summary: 'Analyze historical case notes for follow-up preparation' })
  analyzeCase(@Body() body: CaseAnalysisDto) {
    return this.aiService.analyzeCase(body);
  }
}
