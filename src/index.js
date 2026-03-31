const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
const { loadStore, saveStore, getGuildSettings } = require('./store');

const configPath = path.join(__dirname, '..', 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('Missing config.json. Copy config.example.json to config.json and update values.');
  process.exit(1);
}

const config = require(configPath);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const slashCommands = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a private support ticket')
    .addStringOption((option) =>
      option.setName('reason').setDescription('What do you need help with?').setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post a support panel with a Create Ticket button')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close and archive the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('adduser')
    .setDescription('Add a member to the current ticket channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((option) => option.setName('user').setDescription('Member to add').setRequired(true)),
  new SlashCommandBuilder()
    .setName('removeuser')
    .setDescription('Remove a member from the current ticket channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((option) => option.setName('user').setDescription('Member to remove').setRequired(true)),
  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename the current ticket channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) => option.setName('name').setDescription('New channel name').setRequired(true)),
  new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Set ticket priority')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('level')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Normal', value: 'normal' },
          { name: 'High', value: 'high' },
          { name: 'Urgent', value: 'urgent' }
        )
    ),
  new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Export the current ticket transcript')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show ticket statistics for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('setup-roles')
    .setDescription('Set support roles (comma-separated role IDs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName('role_ids').setDescription('Example: 111,222,333').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setup-channels')
    .setDescription('Set ticket category and log channel for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('category')
        .setDescription('Category for ticket channels')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('log_channel')
        .setDescription('Channel where ticket logs are sent')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  new SlashCommandBuilder().setName('help').setDescription('List all available ticket bot commands')
].map((cmd) => cmd.toJSON());

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: slashCommands
  });
  console.log('Slash commands registered.');
}

function isTicketChannel(store, channelId) {
  return Boolean(store.tickets[channelId]);
}

function hasStaffAccess(member, guildSettings) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return guildSettings.supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function createTicket(guild, user, reason = 'No reason provided') {
  const store = loadStore();
  const guildSettings = getGuildSettings(store, guild.id);

  const categoryId = guildSettings.ticketCategoryId || config.ticketCategoryId || null;
  const supportRoleIds = guildSettings.supportRoleIds.length
    ? guildSettings.supportRoleIds
    : config.supportRoleIds || [];

  const overwriteRoles = supportRoleIds
    .filter((roleId) => guild.roles.cache.has(roleId))
    .map((roleId) => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    }));

  const channelName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `Support ticket for ${user.tag}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      {
        id: guild.ownerId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      ...overwriteRoles
    ]
  });

  store.tickets[channel.id] = {
    guildId: guild.id,
    ownerId: user.id,
    claimedBy: null,
    reason,
    createdAt: new Date().toISOString(),
    priority: 'normal'
  };
  guildSettings.openCount += 1;
  saveStore(store);

  const intro = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Support Ticket Opened')
    .setDescription(
      `Welcome ${user}. A staff member will be with you soon.\n**Reason:** ${reason}\n\nUse /claim to take ownership, /close when resolved.`
    )
    .setTimestamp();

  await channel.send({
    content: `${user} <@${guild.ownerId}>`,
    embeds: [intro]
  });

  return channel;
}

async function sendTranscript(channel, interaction) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()]
    .reverse()
    .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '<embed/attachment>'}`)
    .join('\n');

  const attachment = new AttachmentBuilder(Buffer.from(lines || 'No messages to export.', 'utf8'), {
    name: `${channel.name}-transcript.txt`
  });

  await interaction.reply({ content: 'Transcript generated.', files: [attachment], ephemeral: true });
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await registerSlashCommands();
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'create_ticket_btn') {
    const channel = await createTicket(interaction.guild, interaction.user, 'Opened from panel button');
    await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const store = loadStore();
  const guildSettings = getGuildSettings(store, interaction.guild.id);

  try {
    switch (interaction.commandName) {
      case 'ticket': {
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const channel = await createTicket(interaction.guild, interaction.user, reason);
        await interaction.reply({ content: `Your ticket is ready: ${channel}`, ephemeral: true });
        break;
      }
      case 'panel': {
        const panel = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('Need Help? Open a Support Ticket')
          .setDescription('Press the button below to create a private support ticket.');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket_btn')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
        );
        await interaction.channel.send({ embeds: [panel], components: [row] });
        await interaction.reply({ content: 'Support panel posted.', ephemeral: true });
        break;
      }
      case 'claim': {
        if (!isTicketChannel(store, interaction.channelId)) {
          await interaction.reply({ content: 'This command only works inside a ticket channel.', ephemeral: true });
          break;
        }
        if (!hasStaffAccess(interaction.member, guildSettings)) {
          await interaction.reply({ content: 'Only owner/admin/support roles can claim tickets.', ephemeral: true });
          break;
        }
        store.tickets[interaction.channelId].claimedBy = interaction.user.id;
        saveStore(store);
        await interaction.reply(`Ticket claimed by ${interaction.user}.`);
        break;
      }
      case 'close': {
        if (!isTicketChannel(store, interaction.channelId)) {
          await interaction.reply({ content: 'This command only works inside a ticket channel.', ephemeral: true });
          break;
        }
        if (!hasStaffAccess(interaction.member, guildSettings)) {
          await interaction.reply({ content: 'Only owner/admin/support roles can close tickets.', ephemeral: true });
          break;
        }
        const ticket = store.tickets[interaction.channelId];
        delete store.tickets[interaction.channelId];
        guildSettings.closedCount += 1;
        saveStore(store);

        const logChannelId = guildSettings.logChannelId || config.logChannelId;
        const logChannel = logChannelId ? interaction.guild.channels.cache.get(logChannelId) : null;
        if (logChannel) {
          await logChannel.send(
            `Closed ticket **${interaction.channel.name}** opened by <@${ticket.ownerId}>. Closed by ${interaction.user}.`
          );
        }
        await interaction.reply('Ticket will close in 5 seconds...');
        setTimeout(async () => {
          await interaction.channel.delete('Ticket closed by staff');
        }, 5000);
        break;
      }
      case 'adduser': {
        const user = interaction.options.getUser('user', true);
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
        await interaction.reply(`${user} was added to this ticket.`);
        break;
      }
      case 'removeuser': {
        const user = interaction.options.getUser('user', true);
        await interaction.channel.permissionOverwrites.delete(user.id);
        await interaction.reply(`${user} was removed from this ticket.`);
        break;
      }
      case 'rename': {
        const name = interaction.options.getString('name', true).toLowerCase().replace(/\s+/g, '-');
        await interaction.channel.setName(name.slice(0, 90));
        await interaction.reply(`Renamed ticket to **${name}**.`);
        break;
      }
      case 'priority': {
        const level = interaction.options.getString('level', true);
        if (!isTicketChannel(store, interaction.channelId)) {
          await interaction.reply({ content: 'Run this inside a ticket channel.', ephemeral: true });
          break;
        }
        store.tickets[interaction.channelId].priority = level;
        saveStore(store);
        await interaction.reply(`Ticket priority set to **${level}**.`);
        break;
      }
      case 'transcript': {
        if (!isTicketChannel(store, interaction.channelId)) {
          await interaction.reply({ content: 'Run this inside a ticket channel.', ephemeral: true });
          break;
        }
        await sendTranscript(interaction.channel, interaction);
        break;
      }
      case 'stats': {
        const currentOpen = Object.values(store.tickets).filter((ticket) => ticket.guildId === interaction.guild.id).length;
        const embed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle('Ticket Stats')
          .addFields(
            { name: 'Open Tickets', value: `${currentOpen}`, inline: true },
            { name: 'Total Opened', value: `${guildSettings.openCount}`, inline: true },
            { name: 'Total Closed', value: `${guildSettings.closedCount}`, inline: true }
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      case 'setup-roles': {
        const ids = interaction.options
          .getString('role_ids', true)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
        guildSettings.supportRoleIds = ids;
        saveStore(store);
        await interaction.reply({ content: `Support roles saved (${ids.length}).`, ephemeral: true });
        break;
      }
      case 'setup-channels': {
        const category = interaction.options.getChannel('category');
        const logChannel = interaction.options.getChannel('log_channel');
        guildSettings.ticketCategoryId = category?.id || null;
        guildSettings.logChannelId = logChannel?.id || null;
        saveStore(store);
        await interaction.reply({ content: 'Ticket settings updated for this server.', ephemeral: true });
        break;
      }
      case 'help': {
        const commands = [
          '/ticket',
          '/panel',
          '/claim',
          '/close',
          '/adduser',
          '/removeuser',
          '/rename',
          '/priority',
          '/transcript',
          '/stats',
          '/setup-roles',
          '/setup-channels'
        ];
        await interaction.reply({
          content: `This bot ships with ${commands.length} commands:\n${commands.join('\n')}`,
          ephemeral: true
        });
        break;
      }
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Something went wrong.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
  }
});

client.login(config.token);
