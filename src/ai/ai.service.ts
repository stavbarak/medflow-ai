import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { validateAppointmentExtraction } from './ai-validation';

@Injectable()
export class AiService {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL');
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.client = key
      ? new OpenAI({
          apiKey: key,
          baseURL: baseURL || undefined,
        })
      : null;
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'שירות בינה מלאכותית לא זמין (חסר מפתח API)',
      );
    }
    return this.client;
  }

  /**
   * Extract structured appointment fields from free Hebrew text. Output is validated before return.
   */
  async extractAppointmentFromText(text: string) {
    const openai = this.ensureClient();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You extract medical appointment information from Hebrew text for ONE patient (father). Return a JSON object only, with optional keys: title (string), dateTime (ISO 8601 string in local Israel context if year missing use current/next plausible date), location (string), notes (string), requirements (array of { description: string }). Use Hebrew text values where appropriate. If a field is unknown, omit it.`,
        },
        { role: 'user', content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new ServiceUnavailableException('לא התקבלה תשובה מהמודל');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new ServiceUnavailableException('פלט המודל אינו JSON תקין');
    }
    return validateAppointmentExtraction(parsed);
  }

  /**
   * Turn grounded facts JSON into a short Hebrew reply. Model must not invent facts.
   */
  async answerQuestionFromFacts(question: string, factsJson: string) {
    const openai = this.ensureClient();
    const completion = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You answer questions in Hebrew only. Use ONLY the facts JSON provided by the user message labeled FACTS. If the answer is not in the facts, reply briefly that you are not sure or that it is not stored (in Hebrew). Be concise and natural, suitable for WhatsApp.`,
        },
        {
          role: 'user',
          content: `FACTS:\n${factsJson}\n\nשאלה:\n${question}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return 'לא הצלחתי להבין. נסו לנסח שוב.';
    }
    return text;
  }
}
