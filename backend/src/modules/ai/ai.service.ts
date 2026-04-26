import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseAnalysisDto } from './dto/case-analysis.dto';
import { DashboardService } from '../dashboard/dashboard.service';
import { TremorService } from '../tremor/tremor.service';

type ProviderConfig = {
  providerName: string;
  apiKey?: string;
  baseUrl: string;
  model: string;
  fallbackBaseUrls?: string[];
};

type CompletionResult = {
  text: string | null;
  error: string | null;
};

type EndpointAttemptResult = {
  text: string | null;
  error: string | null;
  priority: number;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
    @Inject(TremorService)
    private readonly tremorService: TremorService,
  ) {}

  async chat(message: string) {
    const needsMedicationBoundary = message.includes('药') || message.includes('量');
    const summary = await this.dashboardService.getSummary();
    const timeline = this.tremorService.getTimeline();

    if (needsMedicationBoundary) {
      return {
        role: 'ai',
        text: '您好，我可以帮您解读今天的数据变化，但不能直接给出具体的药量调整建议。这类决定仍然需要由您的主治医生结合面诊和检查来判断。就今天的数据看，震颤主频大约在 4.8Hz 到 5.2Hz 之间波动，下午时段更值得重点记录。',
        disclaimer: 'AI 生成内容仅供参考，不能替代医生诊断与处方建议。',
      };
    }

    const provider = this.getProviderConfig();

    if (!provider.apiKey) {
      return {
        role: 'ai',
        text: '您好，我先根据今天的监测数据给您一个初步观察。今天比较明显的波动出现在下午 15:00 到 16:00，这段时间的震颤强度高于其他时段。建议把这段时间的服药、休息、活动和情绪状态一起记下来，复诊时会更有参考价值。',
        disclaimer: 'AI 生成内容仅供参考，不能替代医生诊断与处方建议。',
      };
    }

    const condensedTimeline = timeline.map((entry) => ({
      time: entry.time,
      intensity: entry.intensity,
      frequency: entry.frequency,
      isMedication: entry.isMedication,
    }));

    const systemPrompt = [
      'You are Tremor Guard AI, a cautious Parkinson tremor monitoring assistant.',
      'You analyze tremor graphs, medication timing, and dashboard summaries for home health management.',
      'You must not diagnose disease, prescribe medication, or change dosage.',
      'If the user asks for diagnosis or medication adjustment, tell them to speak with their clinician.',
      'Keep answers concise, plain-language, and grounded in the provided dashboard data.',
      'Always mention that the result is for monitoring reference only and not a medical diagnosis.',
    ].join(' ');

    const userPrompt = [
      `Patient greeting: ${summary.header.greeting}`,
      `Status: ${summary.header.statusText}`,
      `Insight summary: ${summary.insights.summary}`,
      `Clinical note: ${summary.insights.clinicalSuggestion}`,
      `Stats: ${JSON.stringify(summary.stats)}`,
      `Timeline: ${JSON.stringify(condensedTimeline)}`,
      `User question: ${message}`,
      'Please explain any visible fluctuation patterns in the chart, especially peaks, timing, and medication relationship when relevant.',
    ].join('\n');

    const completion = await this.requestCompletion(systemPrompt, userPrompt);

    if (!completion.text) {
      return {
        role: 'ai',
        text: '您好，我暂时没能连接到云端分析服务，所以先根据今天已有的监测数据给您一个本地判断。比较明显的波动集中在下午 15:00 到 16:00，这段时间也接近午间服药后 2 到 3 小时。建议您把这一段的症状变化、当时在做什么、以及是否有疲劳或紧张一起记录下来，复诊时提供给医生参考。',
        disclaimer: 'AI 生成内容仅供参考，不能替代医生诊断与处方建议。',
        providerStatus: 'fallback',
        providerName: provider.providerName,
        providerError: completion.error,
      };
    }

    return {
      role: 'ai',
      text: completion.text,
      disclaimer: 'AI 生成内容仅供参考，不能替代医生诊断与处方建议。',
      providerStatus: 'live',
      providerName: provider.providerName,
      providerError: null,
    };
  }

  async analyzeCase(input: CaseAnalysisDto) {
    const summary = await this.dashboardService.getSummary();
    const timeline = this.tremorService.getTimeline();
    const localAnalysis = this.buildCaseAnalysis(input, summary, timeline);

    const providerSummary = await this.requestCaseNarrative(input, localAnalysis, summary, timeline);

    return {
      ...localAnalysis,
      providerSummary,
      generatedAt: new Date().toISOString(),
      disclaimer: '病例分析仅供复诊准备与健康管理参考，不能替代神经内科医生面诊、检查与处方调整。',
    };
  }

  private getProviderConfig(): ProviderConfig {
    const qwenApiKey = this.configService.get<string>('QWEN_API_KEY');
    const qwenBaseUrl = this.configService.get<string>('QWEN_BASE_URL');
    const qwenModel = this.configService.get<string>('QWEN_MODEL');

    if (qwenApiKey) {
      const qwenBaseUrls = [
        qwenBaseUrl,
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
        'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
        'https://cn-hongkong.aliyuncs.com/compatible-mode/v1',
      ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

      return {
        providerName: 'qwen',
        apiKey: qwenApiKey,
        model: qwenModel ?? 'qwen-plus',
        baseUrl: qwenBaseUrls[0],
        fallbackBaseUrls: qwenBaseUrls.slice(1),
      };
    }

    return {
      providerName: 'openai-compatible',
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      model: this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini',
      baseUrl: this.configService.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
      fallbackBaseUrls: [],
    };
  }

  private async requestCompletion(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<CompletionResult> {
    const provider = this.getProviderConfig();

    if (!provider.apiKey) {
      return {
        text: null,
        error: '未配置 API Key',
      };
    }

    const candidateBaseUrls = [
      provider.baseUrl,
      ...(provider.fallbackBaseUrls ?? []),
    ];

    const attemptResults = await Promise.all(
      candidateBaseUrls.map((baseUrl, index) =>
        this.requestCompletionFromBaseUrl(
          provider,
          baseUrl,
          systemPrompt,
          userPrompt,
          index,
        ),
      ),
    );

    const firstSuccess = attemptResults.find((result) => result.text);

    if (firstSuccess?.text) {
      return {
        text: firstSuccess.text,
        error: null,
      };
    }

    const prioritizedError =
      attemptResults
        .sort((left, right) => left.priority - right.priority)
        .find((result) => result.error)?.error ?? '未知错误';

    return {
      text: null,
      error: prioritizedError,
    };
  }

  private async requestCompletionFromBaseUrl(
    provider: ProviderConfig,
    baseUrl: string,
    systemPrompt: string,
    userPrompt: string,
    index: number,
  ): Promise<EndpointAttemptResult> {
    const controller = new AbortController();
    const timeoutMs = this.configService.get<number>('AI_REQUEST_TIMEOUT_MS') ?? 3500;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `上游服务返回 ${response.status}`;
        this.logger.error(
          `${provider.providerName} request failed on ${baseUrl}: ${response.status} ${errorText}`,
        );

        return {
          text: null,
          error: errorMessage,
          priority: this.getErrorPriority(response.status, index),
        };
      }

      const completion = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const text = completion.choices?.[0]?.message?.content?.trim() ?? null;

      return {
        text,
        error: text ? null : '响应为空',
        priority: text ? 99 : 50 + index,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.name === 'AbortError'
          ? `请求超时（>${timeoutMs}ms）`
          : error instanceof Error
            ? error.message
            : String(error);

      this.logger.error(
        `${provider.providerName} network request failed on ${baseUrl}: ${errorMessage}`,
      );

      return {
        text: null,
        error: `网络请求失败：${errorMessage}`,
        priority: 20 + index,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private getErrorPriority(status: number, index: number) {
    if ([401, 403].includes(status)) return 1 + index;
    if (status === 429) return 5 + index;
    return 10 + index;
  }

  private buildCaseAnalysis(
    input: CaseAnalysisDto,
    summary: Awaited<ReturnType<DashboardService['getSummary']>>,
    timeline: ReturnType<TremorService['getTimeline']>,
  ) {
    const combinedText = [
      input.chiefComplaint,
      input.courseOfIllness,
      input.medicationHistory,
      input.visitHistory,
      input.currentConcerns,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchedSignals = [
      {
        key: 'wearingOff',
        title: '药效波动期',
        detail: '病例描述提示午后或下次服药前加重，需重点记录药效维持时长与症状回潮时间。',
        tokens: ['下午', '傍晚', '药效', '波动', 'off', '开关', '加重'],
      },
      {
        key: 'gaitRisk',
        title: '步态/跌倒风险',
        detail: '已出现步态变慢、冻结或跌倒相关线索，复诊时应带上起步困难、转身和夜间如厕表现。',
        tokens: ['步态', '冻结', '跌倒', '起步困难', '拖步', '转身'],
      },
      {
        key: 'nonMotor',
        title: '非运动症状负担',
        detail: '合并睡眠、便秘、情绪或夜间翻身困难等表现，提示评估不能只看震颤强度。',
        tokens: ['睡眠', '失眠', '便秘', '焦虑', '抑郁', '翻身', '夜间'],
      },
      {
        key: 'cognitive',
        title: '认知/精神症状',
        detail: '若存在幻觉、嗜睡或注意力下降，应尽快让医生评估药物耐受与安全性。',
        tokens: ['幻觉', '嗜睡', '意识', '注意力', '认知', '精神'],
      },
      {
        key: 'dyskinesia',
        title: '异动症线索',
        detail: '若服药后出现舞动样或扭动样动作，需与震颤本身区分并向医生说明出现时段。',
        tokens: ['异动', '舞动', '扭动', '不自主'],
      },
    ].filter((signal) => signal.tokens.some((token) => combinedText.includes(token)));

    const peakWindow = timeline
      .filter((entry) => Number(entry.intensity) >= 6)
      .map((entry) => entry.time);

    const overviewPatient = input.patientName?.trim() || summary.patient.displayName;
    const overview = `${overviewPatient}的历史病例提示症状呈慢性进展，并伴有日内波动。结合当前病例摘要，优先关注午后症状加重、步态安全和非运动症状是否同步增加。`;

    const progressionAssessment = matchedSignals.some((signal) => signal.key === 'wearingOff')
      ? '病程更像是在基础震颤之上叠加了药效维持时间缩短，需把“何时开始回潮、多久恢复、是否影响步行/进食”记录清楚。'
      : '从现有描述看，症状以缓慢进展为主，建议继续按周整理关键波动时点，帮助医生判断是否进入新的症状阶段。';

    const timelineCorrelation = matchedSignals.some((signal) => signal.key === 'wearingOff')
      ? `当前监测数据中 ${peakWindow.slice(0, 2).join('、')} 是主要高峰，和病例里提到的午后波动相互印证，可重点回顾午间服药后 2 到 3 小时的表现。`
      : `今日监测仍显示 ${peakWindow.slice(0, 2).join('、')} 附近波动更高，可作为历史病例整理时的时间锚点，对照复诊记录与家属观察。`;

    const monitoringFocus = [
      '连续记录午间服药后 2 到 4 小时的震颤、僵硬和动作迟缓变化。',
      '补充步态冻结、转身困难、夜间翻身和跌倒先兆的出现频次。',
      '把睡眠、便秘、情绪和白天嗜睡等非运动症状按周汇总。',
      '复诊前带上近 1 到 2 周最明显的一次波动时间线和家属观察。',
    ];

    const doctorQuestions = [
      '目前更像药效维持时间缩短，还是基础病情整体进展？',
      '午后加重是否需要进一步区分震颤、僵硬和异动症成分？',
      '步态冻结或跌倒风险是否需要更早干预或康复训练？',
      '非运动症状是否可能与当前用药时段或剂量相关？',
    ];

    const matchedDataPoints = [
      `今日看板结论：${summary.insights.summary}`,
      `临床提示：${summary.insights.clinicalSuggestion}`,
      `高波动时段：${peakWindow.slice(0, 3).join('、') || '暂无明显高峰'}`,
      `服药节点：${timeline.filter((entry) => entry.isMedication).map((entry) => entry.time).join('、')}`,
    ];

    return {
      role: 'ai',
      title: input.caseTitle?.trim() || '历史病例分析结果',
      overview,
      progressionAssessment,
      timelineCorrelation,
      riskSignals:
        matchedSignals.length > 0
          ? matchedSignals.map((signal) => ({
              title: signal.title,
              detail: signal.detail,
            }))
          : [
              {
                title: '需补充更多病程细节',
                detail: '当前病例文字更偏摘要，建议补充症状开始时间、明显加重时段、步态与睡眠变化，能显著提升复诊分析价值。',
              },
            ],
      monitoringFocus,
      doctorQuestions,
      matchedDataPoints,
      caseSnapshot: {
        patientName: overviewPatient,
        chiefComplaint: input.chiefComplaint,
        extractedSignalCount: matchedSignals.length,
      },
    };
  }

  private async requestCaseNarrative(
    input: CaseAnalysisDto,
    analysis: ReturnType<AiService['buildCaseAnalysis']>,
    summary: Awaited<ReturnType<DashboardService['getSummary']>>,
    timeline: ReturnType<TremorService['getTimeline']>,
  ) {
    const provider = this.getProviderConfig();

    if (!provider.apiKey) {
      return null;
    }

    const systemPrompt = [
      'You are Tremor Guard AI, a cautious Parkinson follow-up preparation assistant.',
      'You summarize historical case notes for clinician visits.',
      'Do not diagnose disease, prescribe medication, or suggest dosage changes.',
      'Write in Chinese, 2 to 3 short sentences, plain-language, and clinically cautious.',
      'Mention that the result is for follow-up preparation only.',
    ].join(' ');

    const userPrompt = [
      `Chief complaint: ${input.chiefComplaint}`,
      `Course: ${input.courseOfIllness}`,
      `Medication history: ${input.medicationHistory ?? 'N/A'}`,
      `Visit history: ${input.visitHistory ?? 'N/A'}`,
      `Current concerns: ${input.currentConcerns ?? 'N/A'}`,
      `Dashboard insight: ${summary.insights.summary}`,
      `Peak periods: ${timeline.filter((entry) => Number(entry.intensity) >= 6).map((entry) => entry.time).join(', ')}`,
      `Local overview: ${analysis.overview}`,
      `Local progression assessment: ${analysis.progressionAssessment}`,
      'Return only the short narrative.',
    ].join('\n');

    const completion = await this.requestCompletion(systemPrompt, userPrompt);
    return completion.text;
  }
}
