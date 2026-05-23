import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTasks } from '../src/context/TaskContext';
import { applyReport } from '@shared/commands/report';
import { Colors, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { useMemo } from 'react';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const { tasks } = useTasks();
  const todayStr = today();

  const report = useMemo(() => applyReport(tasks, todayStr), [tasks, todayStr]);

  const projectEntries = useMemo(
    () => Array.from(report.byProject.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [report.byProject]
  );

  const contextEntries = useMemo(
    () => Array.from(report.byContext.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [report.byContext]
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.sectionTitle}>Tasks</Text>
      <View style={styles.card}>
        <Row label="Total" value={report.total} />
        <Row label="Open" value={report.open} />
        <Row label="Done" value={report.done} />
        {report.overdue > 0 && <Row label="Overdue" value={report.overdue} />}
        <Row label="Completed today" value={report.completedToday} />
        <Row label="Completed this week" value={report.completedThisWeek} />
      </View>

      {projectEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>By Project</Text>
          <View style={styles.card}>
            {projectEntries.map(([project, counts]) => (
              <View key={project} style={styles.row}>
                <Text style={styles.rowLabel}>{project}</Text>
                <Text style={styles.rowValue}>
                  {counts.open} open · {counts.done} done
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {contextEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>By Context</Text>
          <View style={styles.card}>
            {contextEntries.map(([context, counts]) => (
              <View key={context} style={styles.row}>
                <Text style={styles.rowLabel}>{context}</Text>
                <Text style={styles.rowValue}>
                  {counts.open} open · {counts.done} done
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  rowLabel: { fontSize: 15, color: Colors.text },
  rowValue: { fontSize: 15, color: Colors.textSecondary },
});
