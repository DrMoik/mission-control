import React, { lazy, Suspense } from 'react';
import { t } from '../../strings.js';

const OverviewView = lazy(() => import('../../views/OverviewView.jsx'));
const InicioView = lazy(() => import('../../views/InicioView.jsx'));
const CategoriesView = lazy(() => import('../../views/CategoriesView.jsx'));
const LeaderboardView = lazy(() => import('../../views/LeaderboardView.jsx'));
const CalendarView = lazy(() => import('../../views/CalendarView.jsx'));
const ToolsView = lazy(() => import('../../views/ToolsView.jsx'));
const AcademyView = lazy(() => import('../../views/AcademyView.jsx'));
const FeedView = lazy(() => import('../../views/FeedView.jsx'));
const ChannelsView = lazy(() => import('../../views/ChannelsView.jsx'));
const FundingView = lazy(() => import('../../views/FundingView.jsx'));
const InventoryView = lazy(() => import('../../views/InventoryView.jsx'));
const TasksView = lazy(() => import('../../views/TasksView.jsx'));
const ProfilePageView = lazy(() => import('../../views/ProfilePageView.jsx'));
const SessionsView = lazy(() => import('../../views/SessionsView.jsx'));
const KnowledgeMapView = lazy(() => import('../../views/KnowledgeMapView.jsx'));
const MembersView = lazy(() => import('../../views/MembersView.jsx'));
const MeritsView = lazy(() => import('../../views/MeritsView.jsx'));
const HRView = lazy(() => import('../../views/HRView.jsx'));
const AdminView = lazy(() => import('../../views/AdminView.jsx'));

export default function AppViewContent({
  view,
  profileMemberId,
  profileMember,
  authState,
  teamState,
  permissions,
  options,
  handlers,
  nav,
}) {
  const { authUser, userProfile, currentMembership, memberRole, isPlatformAdmin, notificationState } = authState;
  const {
    currentTeam,
    teamTasks,
    teamWeeklyStatuses,
    teamMeritEvents,
    teamMemberships,
    teamPosts,
    teamComments,
    teamPostReactions,
    crossTeamChannels,
    crossTeamChannelInvitations,
    teamCategories,
    teamHrComplaints,
    teamMerits,
    leaderboard,
    teamEvents,
    teamSessions,
    teamSwots,
    teamEisenhowers,
    teamPughs,
    teamBoards,
    teamAvailabilityPolls,
    teamMeetings,
    teamGoals,
    teamModules,
    teamModuleAttempts,
    academyBooks,
    teamInventoryItems,
    teamInventoryLoans,
    teamFundingAccounts,
    teamFundingEntries,
    teamHrSuggestions,
    teamSkillProposals,
    meritFamilies,
    knowledgeAreas,
    skillDictionary,
    allTeams,
    tsToDate,
  } = teamState;
  const {
    isAtLeastRookie,
    canEdit,
    canUseCrossTeamChannels,
    canStrike,
    canCreateMerit,
    canAward,
    canViewInventory,
    canManageInventory,
    canViewFunding,
    canEditTools,
    canManageSessions,
  } = permissions;
  const {
    careerOptions,
    semesterOptions,
    personalityTags,
    meritDomains,
    meritTiers,
  } = options;
  const {
    handleViewProfile,
    handleSaveOverview,
    handleCreatePost,
    handleDeletePost,
    handleCreateComment,
    handleDeleteComment,
    handleTogglePostReaction,
    handleCreateCrossTeamChannel,
    handleInviteTeamsToChannel,
    handleAcceptCrossTeamInvitation,
    handleDeclineCrossTeamInvitation,
    handleUpdateCrossTeamChannel,
    handleCreateCrossTeamMessage,
    handleLeaveCrossTeamChannel,
    handleDeleteCrossTeamChannel,
    handleCreateCategory,
    handleDeleteCategory,
    handleUpdateCategory,
    canStrikeMember,
    canRemoveStrikeMember,
    handleUpdateMemberRole,
    handleAssignCategory,
    handleAddStrike,
    handleRemoveStrike,
    handleCreateGhostMember,
    handleApproveMember,
    handleRejectMember,
    handleCreateMerit,
    handleUpdateMerit,
    handleDeleteMerit,
    handleRecoverMerit,
    canEditMerit,
    handleAwardMerit,
    handleRevokeMerit,
    handleEditMeritEvent,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    canEditToolItem,
    handleCreateTask,
    canAssignTask,
    handleCreateSwot,
    handleUpdateSwot,
    handleDeleteSwot,
    handleCreateEisenhower,
    handleUpdateEisenhower,
    handleDeleteEisenhower,
    handleCreatePugh,
    handleUpdatePugh,
    handleDeletePugh,
    handleCreateBoard,
    handleUpdateBoard,
    handleDeleteBoard,
    handleCreateAvailabilityPoll,
    handleUpdateAvailabilityPoll,
    handleDeleteAvailabilityPoll,
    handleCreateMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
    handleCreateGoal,
    handleUpdateGoal,
    handleDeleteGoal,
    handleCreateModule,
    handleUpdateModule,
    handleDeleteModule,
    handleCreateAcademyBook,
    handleUpdateAcademyBook,
    handleDeleteAcademyBook,
    handleRequestModuleReview,
    handleApproveModuleAttempt,
    canEditInventoryItem,
    handleCreateInventoryItem,
    handleUpdateInventoryItem,
    handleDeleteInventoryItem,
    handleCreateInventoryLoan,
    handleReturnInventoryLoan,
    handleCreateFundingAccount,
    handleUpdateFundingAccount,
    handleDeleteFundingAccount,
    handleCreateFundingEntry,
    handleDeleteFundingEntry,
    handleCreateSession,
    handleUpdateSession,
    handleDeleteSession,
    handleSaveAttendance,
    fetchAttendance,
    handleRequestTaskReview,
    handleCancelTaskReviewRequest,
    handleGradeTask,
    handleRejectTaskReview,
    handleDeleteTask,
    handleSetBlocked,
    handleUnblockTask,
    handleUpdateTask,
    handleSubmitHrSuggestion,
    handleSubmitHrComplaint,
    handleAcceptHrSuggestion,
    handleDismissHrSuggestion,
    handleReconsiderHrSuggestion,
    handleSaveTeamCareers,
    handleSaveTeamSemesters,
    handleSaveTeamPersonalityTags,
    handleSaveTeamMeritTags,
    handleSaveTeamMeritTiers,
    handleSaveTeamMeritFamilies,
    handleSaveKnowledgeAreas,
    handleSaveSkillDictionary,
    handleApproveSkillProposal,
    handleRejectSkillProposal,
    handleSaveSystemMeritPoints,
    handleSaveTaskGradePoints,
    handleUpdateMemberProfile,
    handleSaveWeeklyStatus,
    handleProposeSkill,
  } = handlers;
  const { navigate, goToView } = nav;

  return (
    <Suspense fallback={<div className="py-16 text-center text-content-tertiary text-sm">{t('loading')}</div>}>
      {view === 'inicio' && (
        <InicioView
          team={currentTeam}
          teamTasks={teamTasks}
          teamWeeklyStatuses={teamWeeklyStatuses}
          teamMeritEvents={teamMeritEvents}
          teamMemberships={teamMemberships}
          currentMembership={currentMembership}
          tsToDate={tsToDate}
          onNavigateTasks={() => navigate('/tasks')}
          onNavigateProfile={() => navigate('/profile')}
          onNavigateOverview={() => navigate('/overview')}
          onNavigateFeed={() => navigate('/feed')}
        />
      )}
      {view === 'overview' && (
        <OverviewView
          onViewProfile={handleViewProfile}
          team={currentTeam}
          teamMemberships={teamMemberships}
          teamMeritEvents={teamMeritEvents}
          teamPosts={teamPosts}
          teamSessions={teamSessions}
          teamModules={teamModules}
          teamCategories={teamCategories}
          canEdit={canEdit}
          onSave={handleSaveOverview}
          onNavigateFeed={() => navigate('/feed')}
          onNavigateSessions={() => navigate('/sessions')}
        />
      )}
      {view === 'feed' && isAtLeastRookie && (
        <FeedView
          posts={teamPosts}
          comments={teamComments}
          reactions={teamPostReactions}
          authUser={authUser}
          canEdit={canEdit}
          memberships={teamMemberships}
          onCreatePost={handleCreatePost}
          onDeletePost={handleDeletePost}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onToggleReaction={handleTogglePostReaction}
          onViewProfile={handleViewProfile}
        />
      )}
      {view === 'channels' && canUseCrossTeamChannels && (
        <ChannelsView
          currentTeam={currentTeam}
          currentMembership={currentMembership}
          allTeams={allTeams}
          channels={crossTeamChannels}
          pendingInvitations={crossTeamChannelInvitations}
          onCreateChannel={handleCreateCrossTeamChannel}
          onInviteTeams={handleInviteTeamsToChannel}
          onAcceptInvitation={handleAcceptCrossTeamInvitation}
          onDeclineInvitation={handleDeclineCrossTeamInvitation}
          onUpdateChannel={handleUpdateCrossTeamChannel}
          onCreateMessage={handleCreateCrossTeamMessage}
          onLeaveChannel={handleLeaveCrossTeamChannel}
          onDeleteChannel={handleDeleteCrossTeamChannel}
        />
      )}
      {view === 'categories' && isAtLeastRookie && (
        <CategoriesView
          categories={teamCategories}
          memberships={teamMemberships}
          canEdit={canEdit}
          onCreateCategory={handleCreateCategory}
          onDeleteCategory={handleDeleteCategory}
          onUpdateCategory={handleUpdateCategory}
          onViewProfile={handleViewProfile}
        />
      )}
      {view === 'members' && isAtLeastRookie && (
        <MembersView
          categories={teamCategories}
          memberships={teamMemberships}
          complaintsAgainstMember={teamHrComplaints.filter((c) => c.type === 'person' && c.targetMembershipId)}
          canEdit={canEdit}
          canStrike={canStrike}
          canStrikeMember={canStrikeMember}
          canRemoveStrikeMember={canRemoveStrikeMember}
          isPlatformAdmin={isPlatformAdmin}
          careerOptions={careerOptions}
          knowledgeAreas={knowledgeAreas}
          skillDictionary={skillDictionary}
          onUpdateRole={handleUpdateMemberRole}
          onAssignCategory={handleAssignCategory}
          onAddStrike={handleAddStrike}
          onRemoveStrike={handleRemoveStrike}
          onViewProfile={handleViewProfile}
          onCreateGhostMember={handleCreateGhostMember}
          onApproveMember={handleApproveMember}
          onRejectMember={handleRejectMember}
        />
      )}
      {view === 'merits' && isAtLeastRookie && (
        <MeritsView
          merits={teamMerits}
          categories={teamCategories}
          memberships={teamMemberships}
          meritEvents={teamMeritEvents}
          userProfile={userProfile}
          canEdit={canEdit}
          canCreateMerit={canCreateMerit}
          canAward={canAward}
          currentMembership={currentMembership}
          memberRole={memberRole}
          isPlatformAdmin={isPlatformAdmin}
          domains={meritDomains}
          meritTiers={meritTiers}
          meritFamilies={meritFamilies}
          knowledgeAreas={knowledgeAreas}
          onCreateMerit={handleCreateMerit}
          onUpdateMerit={handleUpdateMerit}
          onDeleteMerit={handleDeleteMerit}
          onRecoverMerit={handleRecoverMerit}
          canEditMerit={canEditMerit}
          onAwardMerit={handleAwardMerit}
          onRevokeMerit={handleRevokeMerit}
          onEditMeritEvent={handleEditMeritEvent}
          onViewProfile={handleViewProfile}
        />
      )}
      {view === 'leaderboard' && isAtLeastRookie && (
        <LeaderboardView
          leaderboard={leaderboard}
          memberships={teamMemberships}
          weeklyStatuses={teamWeeklyStatuses}
          tasks={teamTasks}
          categories={teamCategories}
          onViewProfile={handleViewProfile}
        />
      )}
      {view === 'calendar' && isAtLeastRookie && (
        <CalendarView
          teamEvents={teamEvents}
          teamSessions={teamSessions}
          categories={teamCategories}
          memberships={teamMemberships}
          currentMembership={currentMembership}
          canEdit={canEdit}
          canEditTools={canEditTools}
          resolveCanEdit={canEditToolItem}
          onCreateEvent={handleCreateEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}
      {view === 'tools' && isAtLeastRookie && (
        <ToolsView
          team={currentTeam}
          teamEvents={teamEvents}
          teamSwots={teamSwots}
          teamEisenhowers={teamEisenhowers}
          teamPughs={teamPughs}
          teamBoards={teamBoards}
          teamAvailabilityPolls={teamAvailabilityPolls}
          teamMeetings={teamMeetings}
          teamGoals={teamGoals}
          categories={teamCategories}
          memberships={teamMemberships}
          currentMembership={currentMembership}
          memberRole={memberRole}
          canEdit={canEdit}
          canEditTools={canEditTools}
          resolveCanEdit={canEditToolItem}
          onCreateTask={handleCreateTask}
          canAssignTask={canAssignTask}
          onCreateEvent={handleCreateEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          onCreateSwot={handleCreateSwot}
          onUpdateSwot={handleUpdateSwot}
          onDeleteSwot={handleDeleteSwot}
          onCreateEisenhower={handleCreateEisenhower}
          onUpdateEisenhower={handleUpdateEisenhower}
          onDeleteEisenhower={handleDeleteEisenhower}
          onCreatePugh={handleCreatePugh}
          onUpdatePugh={handleUpdatePugh}
          onDeletePugh={handleDeletePugh}
          onCreateBoard={handleCreateBoard}
          onUpdateBoard={handleUpdateBoard}
          onDeleteBoard={handleDeleteBoard}
          onCreateAvailabilityPoll={handleCreateAvailabilityPoll}
          onUpdateAvailabilityPoll={handleUpdateAvailabilityPoll}
          onDeleteAvailabilityPoll={handleDeleteAvailabilityPoll}
          onCreateMeeting={handleCreateMeeting}
          onUpdateMeeting={handleUpdateMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onCreateGoal={handleCreateGoal}
          onUpdateGoal={handleUpdateGoal}
          onDeleteGoal={handleDeleteGoal}
        />
      )}
      {view === 'academy' && isAtLeastRookie && (
        <AcademyView
          modules={teamModules}
          moduleAttempts={teamModuleAttempts}
          books={academyBooks}
          teamMemberships={teamMemberships}
          categories={teamCategories}
          currentMembership={currentMembership}
          canEdit={canEdit}
          canManageBooks={canEditTools}
          knowledgeAreas={knowledgeAreas}
          onCreateModule={handleCreateModule}
          onUpdateModule={handleUpdateModule}
          onDeleteModule={handleDeleteModule}
          onCreateBook={handleCreateAcademyBook}
          onUpdateBook={handleUpdateAcademyBook}
          onDeleteBook={handleDeleteAcademyBook}
          onRequestModuleReview={handleRequestModuleReview}
          onApproveModuleAttempt={handleApproveModuleAttempt}
        />
      )}
      {view === 'inventory' && canViewInventory && (
        <InventoryView
          items={teamInventoryItems}
          loans={teamInventoryLoans}
          categories={teamCategories}
          memberships={teamMemberships}
          canManageInventory={canManageInventory}
          currentMembership={currentMembership}
          canEditItem={canEditInventoryItem}
          onCreateItem={handleCreateInventoryItem}
          onUpdateItem={handleUpdateInventoryItem}
          onDeleteItem={handleDeleteInventoryItem}
          onCreateLoan={handleCreateInventoryLoan}
          onReturnLoan={handleReturnInventoryLoan}
        />
      )}
      {view === 'funding' && canViewFunding && (
        <FundingView
          accounts={teamFundingAccounts}
          entries={teamFundingEntries}
          canEdit={canEditTools}
          onCreateAccount={handleCreateFundingAccount}
          onUpdateAccount={handleUpdateFundingAccount}
          onDeleteAccount={handleDeleteFundingAccount}
          onCreateEntry={handleCreateFundingEntry}
          onDeleteEntry={handleDeleteFundingEntry}
        />
      )}
      {view === 'sessions' && isAtLeastRookie && (
        <SessionsView
          sessions={teamSessions}
          memberships={teamMemberships}
          categories={teamCategories}
          canManageSessions={canManageSessions}
          authUser={authUser}
          onCreateSession={handleCreateSession}
          onUpdateSession={handleUpdateSession}
          onDeleteSession={handleDeleteSession}
          onSaveAttendance={handleSaveAttendance}
          fetchAttendance={fetchAttendance}
        />
      )}
      {view === 'mapa' && isAtLeastRookie && (
        <KnowledgeMapView
          memberships={teamMemberships}
          moduleAttempts={teamModuleAttempts}
          modules={teamModules}
          knowledgeAreas={knowledgeAreas}
          onViewProfile={handleViewProfile}
        />
      )}
      {view === 'tasks' && isAtLeastRookie && (
        <TasksView
          tasks={teamTasks}
          memberships={teamMemberships}
          currentMembership={currentMembership}
          canViewAllTasks={canEdit}
          onRequestTaskReview={handleRequestTaskReview}
          onCancelTaskReviewRequest={handleCancelTaskReviewRequest}
          onGradeTask={handleGradeTask}
          onRejectTaskReview={handleRejectTaskReview}
          onDeleteTask={handleDeleteTask}
          onSetBlocked={handleSetBlocked}
          onUnblockTask={handleUnblockTask}
          onUpdateTask={handleUpdateTask}
          knowledgeAreas={knowledgeAreas}
          tsToDate={tsToDate}
        />
      )}
      {view === 'hr' && isAtLeastRookie && (
        <HRView
          suggestions={teamHrSuggestions}
          complaints={teamHrComplaints}
          categories={teamCategories}
          memberships={teamMemberships}
          canViewHr={canEdit}
          isFaculty={isPlatformAdmin || memberRole === 'facultyAdvisor'}
          authUserId={authUser?.uid}
          onSubmitSuggestion={handleSubmitHrSuggestion}
          onSubmitComplaint={handleSubmitHrComplaint}
          onAcceptSuggestion={handleAcceptHrSuggestion}
          onDismissSuggestion={handleDismissHrSuggestion}
          onReconsiderSuggestion={handleReconsiderHrSuggestion}
          suggestionMeritPoints={[50, 100, 150, 200]}
        />
      )}
      {view === 'admin' && canEdit && (
        <AdminView
          key={currentTeam?.id}
          team={currentTeam}
          t={t}
          onSaveCareers={handleSaveTeamCareers}
          onSaveSemesters={handleSaveTeamSemesters}
          onSavePersonalityTags={handleSaveTeamPersonalityTags}
          onSaveMeritTags={handleSaveTeamMeritTags}
          onSaveMeritTiers={handleSaveTeamMeritTiers}
          onSaveMeritFamilies={handleSaveTeamMeritFamilies}
          onSaveKnowledgeAreas={handleSaveKnowledgeAreas}
          onSaveSkillDictionary={handleSaveSkillDictionary}
          skillProposals={teamSkillProposals}
          memberships={teamMemberships}
          onApproveSkillProposal={handleApproveSkillProposal}
          onRejectSkillProposal={handleRejectSkillProposal}
          onSaveSystemMeritPoints={handleSaveSystemMeritPoints}
          onSaveTaskGradePoints={handleSaveTaskGradePoints}
        />
      )}
      {view === 'myprofile' && (
        currentMembership ? (
          <ProfilePageView
            membership={currentMembership}
            categories={teamCategories}
            merits={teamMerits}
            meritEvents={teamMeritEvents.filter((entry) => entry.membershipId === currentMembership.id)}
            tasks={teamTasks}
            modules={teamModules}
            moduleAttempts={teamModuleAttempts}
            meritFamilies={meritFamilies}
            knowledgeAreas={knowledgeAreas}
            skillDictionary={skillDictionary}
            allMeritEvents={teamMeritEvents}
            canEditThis={isPlatformAdmin || (authUser && currentMembership.userId === authUser.uid)}
            onSave={handleUpdateMemberProfile}
            weeklyStatuses={teamWeeklyStatuses.filter((entry) => entry.membershipId === currentMembership.id)}
            onSaveWeeklyStatus={handleSaveWeeklyStatus}
            onProposeSkill={handleProposeSkill}
            careerOptions={careerOptions}
            semesterOptions={semesterOptions}
            personalityTags={personalityTags}
            onNavigate={goToView}
            notificationSettings={notificationState}
          />
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">{t('loading')}</div>
        )
      )}
      {view === 'profile' && profileMemberId && !profileMember && (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm">{t('member_not_found')}</p>
        </div>
      )}
      {view === 'profile' && profileMember && (
        <ProfilePageView
          membership={profileMember}
          categories={teamCategories}
          merits={teamMerits}
          meritEvents={teamMeritEvents.filter((entry) => entry.membershipId === profileMember.id)}
          tasks={teamTasks}
          modules={teamModules}
          moduleAttempts={teamModuleAttempts}
          meritFamilies={meritFamilies}
          knowledgeAreas={knowledgeAreas}
          skillDictionary={skillDictionary}
          allMeritEvents={teamMeritEvents}
          canEditThis={isPlatformAdmin || (authUser && profileMember.userId === authUser.uid)}
          onSave={handleUpdateMemberProfile}
          weeklyStatuses={teamWeeklyStatuses.filter((entry) => entry.membershipId === profileMember.id)}
          onSaveWeeklyStatus={handleSaveWeeklyStatus}
          onProposeSkill={handleProposeSkill}
          careerOptions={careerOptions}
          semesterOptions={semesterOptions}
          personalityTags={personalityTags}
          onNavigate={goToView}
        />
      )}
    </Suspense>
  );
}
