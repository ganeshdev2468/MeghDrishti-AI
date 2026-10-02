package com.meghdrishti.ai.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Room database for local offline-first alert storage.
 */
@Database(entities = [AlertEntity::class], version = 1, exportSchema = false)
abstract class MeghDrishtiDatabase : RoomDatabase() {

    abstract fun alertDao(): AlertDao

    companion object {
        @Volatile
        private var INSTANCE: MeghDrishtiDatabase? = null

        fun getInstance(context: Context): MeghDrishtiDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    MeghDrishtiDatabase::class.java,
                    "meghdrishti_db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
