import { BaseService } from './BaseService';

export class PublicationService extends BaseService {
  
  // ISOLAMENTO CRÍTICO: Publicações são isoladas POR USUÁRIO
  async getAll(filters?: any) {
    this.requirePermission('read', 'publications');

    let sql = `
      SELECT * FROM \${schema}.publications 
      WHERE user_id = $1
    `;
    const params: any[] = [this.user.id]; // ISOLAMENTO POR USUÁRIO

    if (filters?.search) {
      sql += ` AND (processo ILIKE $${params.length + 1} OR nome_pesquisado ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    sql += ` ORDER BY data_publicacao DESC, created_at DESC`;

    return await this.query(sql, params);
  }

  async getById(id: string) {
    this.requirePermission('read', 'publications');

    const results = await this.query(`
      SELECT * FROM \${schema}.publications 
      WHERE id = $1 AND user_id = $2
    `, [id, this.user.id]); // ISOLAMENTO POR USUÁRIO

    if (!results || results.length === 0) {
      throw new Error('Publicação não encontrada');
    }

    return results[0];
  }

  async create(publicationData: any) {
    this.requirePermission('write', 'publications');

    const {
      data_publicacao, processo, diario, vara_comarca, nome_pesquisado,
      status, conteudo, observacoes, responsavel, numero_processo,
      cliente, urgencia, tags
    } = publicationData;

    const results = await this.query(`
      INSERT INTO \${schema}.publications (
        user_id, data_publicacao, processo, diario, vara_comarca,
        nome_pesquisado, status, conteudo, observacoes, responsavel,
        numero_processo, cliente, urgencia, tags, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      ) RETURNING *
    `, [
      this.user.id, // ISOLAMENTO POR USUÁRIO
      data_publicacao, processo, diario, vara_comarca, nome_pesquisado,
      status || 'nova', conteudo, observacoes, responsavel,
      numero_processo, cliente, urgencia || 'media', JSON.stringify(tags || [])
    ]);

    const publication = results[0];

    await this.auditLog('publications', 'CREATE', publication.id, null, publication);

    return publication;
  }

  async updateStatus(id: string, status: string, observacoes?: string) {
    this.requirePermission('write', 'publications');

    const oldPublication = await this.getById(id);

    const results = await this.query(`
      UPDATE \${schema}.publications SET
        status = $1,
        observacoes = COALESCE($2, observacoes),
        updated_at = NOW()
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [status, observacoes, id, this.user.id]); // ISOLAMENTO POR USUÁRIO

    const publication = results[0];

    await this.auditLog('publications', 'UPDATE', id, oldPublication, publication);

    // Notificação automática quando status muda de NOVA para PENDENTE
    if (oldPublication.status === 'nova' && status === 'pendente') {
      await this.createNotification(
        'info',
        'Publicação Visualizada',
        `${this.user.name} visualizou a publicação ${publication.processo}`,
        'publications',
        'publication',
        publication.id,
        { publication_id: publication.id, page: '/publicacoes' }
      );
    }

    return publication;
  }

  async assignToUser(id: string, assignedUserId: string, assignedUserName: string) {
    this.requirePermission('write', 'publications');

    const oldPublication = await this.getById(id);

    const results = await this.query(`
      UPDATE \${schema}.publications SET
        status = 'atribuida',
        responsavel = $1,
        atribuido_para_id = $2,
        atribuido_para_nome = $3,
        data_atribuicao = NOW(),
        updated_at = NOW()
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [assignedUserName, assignedUserId, assignedUserName, id, this.user.id]);

    const publication = results[0];

    await this.auditLog('publications', 'UPDATE', id, oldPublication, publication);

    await this.createNotification(
      'info',
      'Publicação Atribuída',
      `${this.user.name} atribuiu publicação para ${assignedUserName}`,
      'publications',
      'publication',
      publication.id,
      { publication_id: publication.id, page: '/publicacoes' },
      assignedUserId
    );

    return publication;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'publications');

    const publication = await this.getById(id);

    await this.query(`
      DELETE FROM \${schema}.publications 
      WHERE id = $1 AND user_id = $2
    `, [id, this.user.id]); // ISOLAMENTO POR USUÁRIO

    await this.auditLog('publications', 'DELETE', id, publication, null);
  }

  async getStats() {
    this.requirePermission('read', 'publications');

    const [total, novas, pendentes, atribuidas, finalizadas, descartadas] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM \${schema}.publications WHERE user_id = $1`, [this.user.id]),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.publications WHERE user_id = $1 AND status = 'nova'`, [this.user.id]),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.publications WHERE user_id = $1 AND status = 'pendente'`, [this.user.id]),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.publications WHERE user_id = $1 AND status = 'atribuida'`, [this.user.id]),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.publications WHERE user_id = $1 AND status = 'finalizada'`, [this.user.id]),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.publications WHERE user_id = $1 AND status = 'descartada'`, [this.user.id])
    ]);

    const totalCount = total[0]?.count || 0;
    const finalizadaCount = finalizadas[0]?.count || 0;

    return {
      total: totalCount,
      novas: novas[0]?.count || 0,
      pendentes: pendentes[0]?.count || 0,
      atribuidas: atribuidas[0]?.count || 0,
      finalizadas: finalizadaCount,
      descartadas: descartadas[0]?.count || 0,
      porcentagemConcluidas: totalCount > 0 ? Math.round((finalizadaCount / totalCount) * 100) : 0
    };
  }
}