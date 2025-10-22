import { EnduranceRouter, EnduranceAuthMiddleware, SecurityOptions, enduranceEmitter, enduranceEventTypes } from '@programisto/endurance-core';
import TicketModel from '../models/ticket.model.js';
import NoteModel from '../models/note.model.js';
import UserModel from '../models/user.model.js';

class TicketsAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les tickets
        this.get('/', securityOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';
                const status = req.query.status as string || '';
                const category = req.query.category as string || '';
                const assignedTo = req.query.assignedTo as string || '';
                const createdBy = req.query.createdBy as string || '';

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur titre et description
                if (search) {
                    query.$or = [
                        { title: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                // Filtres
                if (status) {
                    query.status = status;
                }

                if (category) {
                    query.category = category;
                }

                if (assignedTo) {
                    query.assignedTo = assignedTo;
                }

                if (createdBy) {
                    query.createdBy = createdBy;
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [tickets, total] = await Promise.all([
                    TicketModel.find(query)
                        .populate('assignedTo', 'firstname lastname email')
                        .populate('createdBy', 'firstname lastname email')
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    TicketModel.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: tickets,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems: total,
                        itemsPerPage: limit,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des tickets:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer un nouveau ticket
        this.post('/', securityOptions, async (req: any, res: any) => {
            try {
                const ticket = new TicketModel({
                    ...req.body,
                    createdBy: req.body.createdBy || req.user._id
                });
                await ticket.save();

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                return res.status(201).json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors de la création du ticket:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer un ticket par ID
        this.get('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findById(req.params.id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                return res.json(ticket);
            } catch (error) {
                console.error('Erreur lors de la récupération du ticket:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier un ticket existant
        this.put('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findById(req.params.id);

                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                Object.assign(ticket, req.body);
                ticket.updatedAt = new Date();
                await ticket.save();

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                return res.json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors de la modification du ticket:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer un ticket
        this.delete('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findByIdAndDelete(req.params.id);
                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                // Supprimer toutes les notes associées
                await NoteModel.deleteMany({ ticketId: ticket._id });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du ticket:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Assigner un ticket à un utilisateur
        this.post('/:id/assign', securityOptions, async (req: any, res: any) => {
            try {
                const { assignedTo } = req.body;
                const ticket = await TicketModel.findById(req.params.id);

                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                // Vérifier que l'utilisateur existe
                if (assignedTo) {
                    const user = await UserModel.findById(assignedTo);
                    if (!user) {
                        return res.status(400).json({ error: 'Utilisateur assigné non trouvé' });
                    }
                }

                ticket.assignedTo = assignedTo;
                ticket.updatedAt = new Date();
                await ticket.save();

                // Émettre un événement pour l'assignation
                enduranceEmitter.emit(enduranceEventTypes.TICKET_ASSIGNED, {
                    userId: req.user._id,
                    ticketId: ticket._id,
                    assignedTo
                });

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                return res.json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors de l\'assignation du ticket:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier le statut d'un ticket
        this.post('/:id/status', securityOptions, async (req: any, res: any) => {
            try {
                const { status } = req.body;

                if (!status || !['OUVERT', 'EN_COURS', 'FERME'].includes(status)) {
                    return res.status(400).json({ error: 'Statut invalide. Doit être OUVERT, EN_COURS ou FERME' });
                }

                const ticket = await TicketModel.findById(req.params.id);

                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                ticket.status = status;
                ticket.updatedAt = new Date();
                await ticket.save();

                // Émettre un événement pour le changement de statut
                enduranceEmitter.emit(enduranceEventTypes.TICKET_STATUS_CHANGED, {
                    userId: req.user._id,
                    ticketId: ticket._id,
                    newStatus: status
                });

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                return res.json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors du changement de statut du ticket:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer les notes d'un ticket
        this.get('/:id/notes', securityOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findById(req.params.id);

                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                const notes = await NoteModel.find({ ticketId: req.params.id })
                    .populate('createdBy', 'firstname lastname email')
                    .sort({ createdAt: -1 })
                    .exec();

                res.json(notes);
            } catch (error) {
                console.error('Erreur lors de la récupération des notes:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Ajouter une note à un ticket
        this.post('/:id/notes', securityOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findById(req.params.id);

                if (!ticket) {
                    return res.status(404).send('Ticket non trouvé');
                }

                const note = new NoteModel({
                    content: req.body.content,
                    createdBy: req.user._id,
                    ticketId: req.params.id
                });
                await note.save();

                // Ajouter la référence de la note au ticket
                ticket.notes.push(note._id);
                ticket.updatedAt = new Date();
                await ticket.save();

                // Émettre un événement pour l'ajout d'une note
                enduranceEmitter.emit(enduranceEventTypes.TICKET_NOTE_ADDED, {
                    userId: req.user._id,
                    ticketId: ticket._id,
                    noteId: note._id
                });

                const populatedNote = await NoteModel.findById(note._id)
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                res.status(201).json(populatedNote);
            } catch (error) {
                console.error('Erreur lors de l\'ajout de la note:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Statistiques des tickets
        this.get('/stats/overview', securityOptions, async (req: any, res: any) => {
            try {
                const [
                    totalTickets,
                    openTickets,
                    inProgressTickets,
                    closedTickets,
                    ticketsByCategory,
                    ticketsWithoutAssignment
                ] = await Promise.all([
                    TicketModel.countDocuments(),
                    TicketModel.countDocuments({ status: 'OUVERT' }),
                    TicketModel.countDocuments({ status: 'EN_COURS' }),
                    TicketModel.countDocuments({ status: 'FERME' }),
                    TicketModel.aggregate([
                        {
                            $group: {
                                _id: '$category',
                                count: { $sum: 1 }
                            }
                        }
                    ]),
                    TicketModel.countDocuments({ assignedTo: { $exists: false } })
                ]);

                return res.json({
                    total: totalTickets,
                    open: openTickets,
                    inProgress: inProgressTickets,
                    closed: closedTickets,
                    byCategory: ticketsByCategory,
                    withoutAssignment: ticketsWithoutAssignment
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des statistiques:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Autocomplete pour les utilisateurs (pour les filtres et assignations)
        this.get('/autocomplete/users', securityOptions, async (req: any, res: any) => {
            try {
                const search = req.query.search as string || '';
                const limit = parseInt(req.query.limit as string) || 10;

                const query: any = {};
                if (search) {
                    query.$or = [
                        { firstname: { $regex: search, $options: 'i' } },
                        { lastname: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ];
                }

                const users = await UserModel.find(query)
                    .select('_id firstname lastname email')
                    .limit(limit)
                    .sort({ firstname: 1, lastname: 1 })
                    .exec();

                return res.json(users);
            } catch (error) {
                console.error('Erreur lors de la récupération des utilisateurs:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new TicketsAdminRouter();
export default router;
