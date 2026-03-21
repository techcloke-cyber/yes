package dev.openai.greatsea;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.WorldCreator;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

public final class GreatSeaCommandExecutor implements CommandExecutor, TabCompleter {
    private final GreatSeaGenerator generator;

    public GreatSeaCommandExecutor(GreatSeaGenerator generator) {
        this.generator = generator;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage(ChatColor.AQUA + "Usage: /greatsea <create|tp> [world] [seed]");
            return true;
        }

        String action = args[0].toLowerCase(Locale.ROOT);
        return switch (action) {
            case "create" -> handleCreate(sender, args);
            case "tp", "teleport" -> handleTeleport(sender, args);
            default -> {
                sender.sendMessage(ChatColor.RED + "Unknown subcommand. Try create or tp.");
                yield true;
            }
        };
    }

    private boolean handleCreate(CommandSender sender, String[] args) {
        String worldName = args.length >= 2 ? args[1] : "great_sea";
        WorldCreator creator = new WorldCreator(worldName)
            .environment(World.Environment.NORMAL)
            .generator(generator);

        if (args.length >= 3) {
            try {
                creator.seed(Long.parseLong(args[2]));
            } catch (NumberFormatException ex) {
                sender.sendMessage(ChatColor.RED + "Seed must be a whole number.");
                return true;
            }
        }

        sender.sendMessage(ChatColor.AQUA + "Generating Great Sea world '" + worldName + "'...");
        World world = Bukkit.createWorld(creator);
        if (world == null) {
            sender.sendMessage(ChatColor.RED + "World creation failed. Check the server log for details.");
            return true;
        }

        world.setSpawnFlags(true, true);
        world.setStorm(false);
        world.setTime(6000L);
        sender.sendMessage(ChatColor.GREEN + "Great Sea world ready: " + world.getName());

        if (sender instanceof Player player) {
            teleportToSpawn(player, world);
        }

        return true;
    }

    private boolean handleTeleport(CommandSender sender, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(ChatColor.RED + "Only players can use /greatsea tp.");
            return true;
        }

        String worldName = args.length >= 2 ? args[1] : "great_sea";
        World world = Bukkit.getWorld(worldName);
        if (world == null) {
            sender.sendMessage(ChatColor.RED + "World '" + worldName + "' is not loaded. Use /greatsea create first.");
            return true;
        }

        teleportToSpawn(player, world);
        sender.sendMessage(ChatColor.GREEN + "Sailing to " + worldName + "!");
        return true;
    }

    private void teleportToSpawn(Player player, World world) {
        Location spawn = world.getHighestBlockAt(0, 0).getLocation().add(0.5D, 1.0D, 0.5D);
        player.teleport(spawn);
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return List.of("create", "tp");
        }

        if (args.length == 2 && args[0].equalsIgnoreCase("tp")) {
            return new ArrayList<>(Bukkit.getWorlds().stream().map(World::getName).toList());
        }

        return List.of();
    }
}
