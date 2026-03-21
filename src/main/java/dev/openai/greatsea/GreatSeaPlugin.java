package dev.openai.greatsea;

import java.util.Objects;
import org.bukkit.command.PluginCommand;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.plugin.java.JavaPlugin;

public final class GreatSeaPlugin extends JavaPlugin {
    private GreatSeaGenerator generator;

    @Override
    public void onEnable() {
        this.generator = new GreatSeaGenerator();

        PluginCommand command = Objects.requireNonNull(getCommand("greatsea"), "greatsea command missing");
        GreatSeaCommandExecutor executor = new GreatSeaCommandExecutor(generator);
        command.setExecutor(executor);
        command.setTabCompleter(executor);

        getLogger().info("GreatSea enabled. Use /greatsea create <world> [seed] to make a new ocean world.");
    }

    @Override
    public ChunkGenerator getDefaultWorldGenerator(String worldName, String id) {
        if (generator == null) {
            generator = new GreatSeaGenerator();
        }
        return generator;
    }
}
