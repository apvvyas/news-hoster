import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  FatalRestructureError,
  TransientRestructureError,
} from '../pipeline/restructurer.js';
import { User } from '../users/user.entity.js';
import { ArticleTranslation, versionContent } from './article.entity.js';
import { ArticlesService } from './articles.service.js';
import { ArticleChatMessage, ChatRole } from './chat-message.entity.js';
import { EDITOR_ASSISTANT, type EditorAssistant } from './editor-assistant.js';
import { RevisionsService } from './revisions.service.js';

@Injectable()
export class EditorialChatService {
  constructor(
    @InjectRepository(ArticleChatMessage)
    private readonly messages: Repository<ArticleChatMessage>,
    @Inject(EDITOR_ASSISTANT)
    private readonly assistant: EditorAssistant | null,
    private readonly articles: ArticlesService,
    private readonly revisions: RevisionsService,
    private readonly dataSource: DataSource,
  ) {}

  get available(): boolean {
    return this.assistant !== null;
  }

  list(articleId: string, language: string): Promise<ArticleChatMessage[]> {
    return this.messages.find({
      where: { article: { id: articleId }, language },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  /** Store the editor's message, ask the assistant, store and return its reply. */
  async send(
    articleId: string,
    language: string,
    text: string,
    userId: string,
  ): Promise<ArticleChatMessage[]> {
    if (!this.assistant)
      throw new ServiceUnavailableException(
        'The editorial assistant needs SARVAM_API_KEY to be configured',
      );
    const article = await this.articles.get(articleId);
    const version = this.articles.translation(article, language);
    const history = await this.list(articleId, language);

    const userMsg = await this.messages.save(
      this.messages.create({
        article: { id: articleId },
        language,
        role: ChatRole.User,
        content: text,
        author: { id: userId } as User,
      }),
    );
    let suggestion;
    try {
      suggestion = await this.assistant.suggest({
        language,
        current: versionContent(version),
        source: article.item
          ? {
              title: article.item.title,
              content: article.item.content,
              name: article.sourceName,
            }
          : null,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        instruction: text,
      });
    } catch (err) {
      await this.messages.delete(userMsg.id); // let the editor simply resend
      if (
        err instanceof TransientRestructureError ||
        err instanceof FatalRestructureError
      )
        throw new ServiceUnavailableException(err.message);
      throw err;
    }
    const reply = await this.messages.save(
      this.messages.create({
        article: { id: articleId },
        language,
        role: ChatRole.Assistant,
        content: suggestion.reply,
        proposal: suggestion.proposal,
      }),
    );
    return [userMsg, reply];
  }

  /** Apply an assistant proposal to the language version, recording a revision. */
  async apply(
    articleId: string,
    messageId: string,
    userId: string,
  ): Promise<ArticleChatMessage> {
    const msg = await this.messages.findOneBy({
      id: messageId,
      article: { id: articleId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (!msg.proposal)
      throw new ConflictException('This message has no proposal to apply');
    if (msg.appliedRevisionId)
      throw new ConflictException('This proposal was already applied');
    const article = await this.articles.get(articleId);
    const version = this.articles.translation(article, msg.language);

    await this.dataSource.transaction(async (m) => {
      Object.assign(version, msg.proposal);
      await m.save(ArticleTranslation, version);
      const rev = await this.revisions.snapshot(
        article,
        version,
        'Applied assistant suggestion',
        userId,
        m,
      );
      msg.appliedRevisionId = rev.id;
      await m.save(msg);
    });
    return msg;
  }
}
