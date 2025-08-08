document.addEventListener('DOMContentLoaded', () => {
    let state = { selectedProgramId: null, selectedProgramName: null, programs: [], users: [], currentProgramFields: [], roles: [], permissions: [], selectedRoleId: null, selectedUserId: null };
    
    // --- Initializer ---
    async function initializeApp() {
        addEventListeners();
        
        [state.programs, state.users, state.roles, state.permissions] = await Promise.all([
            fetch("/api/programs").then(res => res.json()),
            fetch("/api/users").then(res => res.json()),
            fetch("/api/roles").then(res => res.json()),
            fetch("/api/permissions").then(res => res.json())
        ]);
        
        renderProgramsPage();
        renderUsersPage();
        renderRolesPage();
        
        showPage('programs');
    }

    // --- Navigation & Page Rendering ---
    function showPage(pageId) {
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        const elementId = pageId.endsWith('-page') ? pageId : `${pageId}-page`;
        const pageElement = document.getElementById(elementId);
        if (pageElement) pageElement.classList.add('active');

        document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === pageId.replace('-page', '')));
        
        const isDetailPage = pageId === 'program-detail-page';
        document.getElementById('secondary-sidebar').classList.toggle('hidden', !isDetailPage);
        document.querySelector('.main-content').classList.toggle('detail-view-active', isDetailPage);
    }
    
    function showProgramDetailPage(programId, programName) {
        state.selectedProgramId = programId;
        state.selectedProgramName = programName;
        document.getElementById('detail-program-name').textContent = state.selectedProgramName;
        
        const secondaryNav = document.getElementById('secondary-nav');
        secondaryNav.innerHTML = `
            <a href="#" class="subnav-link" data-subpage="access">Users & Access</a>
            <a href="#" class="subnav-link" data-subpage="form">Form Builder</a>
        `;
        // This is the critical fix - re-attaching the listeners for the sub-menu
        secondaryNav.querySelectorAll(".subnav-link").forEach(link => link.addEventListener("click", e => showSubPage(e.target.dataset.subpage)));
        
        document.getElementById('access-subpage').innerHTML = getUserAccessTemplate();
        document.getElementById('form-subpage').innerHTML = getFormBuilderTemplate();
        
        addDetailViewEventListeners();
        
        document.getElementById('access-user-select').innerHTML = state.users.map(u => `<option value="${u.id}">${u.firstName} ${u.lastName} (${u.email})</option>`).join('');
        
        showPage('program-detail-page');
        showSubPage('access'); // Show the default subpage
    }

    function showSubPage(subpageId){
        document.querySelectorAll(".subpage-content").forEach(sp=>sp.classList.remove("active"));
        document.getElementById(`${subpageId}-subpage`).classList.add("active");
        document.querySelectorAll(".subnav-link").forEach(l=>l.classList.toggle("active",l.dataset.subpage===subpageId));
        if(subpageId==="access") loadAccessData(state.selectedProgramId);
        if(subpageId==="form") loadFormBuilderData(state.selectedProgramId);
    }

    function renderProgramsPage(){document.getElementById("program-list").innerHTML=state.programs.map(p=>`<div class="list-item"><span>${p.name}</span><button class="manage-program-btn secondary-action" data-id="${p.id}" data-name="${p.name}">Manage</button></div>`).join(""),document.querySelectorAll(".manage-program-btn").forEach(btn=>btn.addEventListener("click",e=>showProgramDetailPage(e.target.dataset.id,e.target.dataset.name)))}
    function renderUsersPage(){document.getElementById("user-list").innerHTML=state.users.map(u=>`<div class="list-item"><span>${u.firstName} ${u.lastName} (${u.email})</span><div><button class="manage-roles-btn secondary-action" data-id="${u.id}" data-name="${u.firstName} ${u.lastName}">Manage Roles</button> <button class="deactivate-btn destructive-action" data-id="${u.id}" ${"deactivated"===u.status?"disabled":""}>Deactivate</button></div></div>`).join(""),document.querySelectorAll(".deactivate-btn").forEach(b=>b.addEventListener("click",handleDeactivateUser)),document.querySelectorAll(".manage-roles-btn").forEach(b=>b.addEventListener("click",showAssignRolesPage))}
    function renderRolesPage(){const rolesList=document.getElementById("roles-list");if(!rolesList)return;rolesList.innerHTML=state.roles.map(role=>`<div class="list-item role-item" data-id="${role.id}">${role.name}</div>`).join(""),document.querySelectorAll(".role-item").forEach(item=>item.addEventListener("click",handleRoleSelect))}
    
    // --- Event Listener Setup ---
    function addEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => showPage(e.target.dataset.page)));
        document.querySelectorAll('.back-link').forEach(link => link.addEventListener('click', (e) => showPage(e.target.dataset.target)));
        document.getElementById('go-to-create-program').addEventListener('click', () => showPage('create-program'));
        document.getElementById('go-to-invite-user').addEventListener('click', () => showPage('invite-user'));
        document.getElementById('create-program-form').addEventListener('submit', handleCreateProgram);
        document.getElementById('invite-user-form').addEventListener('submit', handleInviteUser);
        document.getElementById('create-role-form').addEventListener('submit', handleCreateRole);
        document.getElementById('permissions-form').addEventListener('submit', handleSavePermissions);
        document.getElementById('assign-roles-form').addEventListener('submit', handleAssignRoles);
    }

    function addDetailViewEventListeners(){
        document.getElementById("assign-access-form").addEventListener("submit",handleAssignAccess);
        document.getElementById("add-field-form").addEventListener("submit",handleAddField);
        document.getElementById("bulk-assign-form").addEventListener("submit",handleBulkAssign);
        document.getElementById("field-type-builder").addEventListener("change",handleFieldTypeChange);
        document.getElementById("add-option-btn").addEventListener("click",()=>addDropdownOptionRow());
        document.getElementById("dropdown-options-list").addEventListener("click",handleDropdownListClick);
        document.getElementById("conditional-checkbox").addEventListener("change",e=>{document.getElementById("conditional-logic-builder").classList.toggle("hidden",!e.target.checked)});
        document.getElementById("parent-question-select").addEventListener("change",e=>handleParentQuestionChange(e.target,document.getElementById("parent-answer-select")));
    }
    
    // --- All other specific helper functions ---
    async function showAssignRolesPage(e){state.selectedUserId=e.target.dataset.id,document.getElementById("assign-roles-user-name").textContent=e.target.dataset.name;const t=await(await fetch(`/api/users/${state.selectedUserId}/roles`)).json(),n=document.getElementById("assign-roles-list");n.innerHTML=state.roles.map(e=>`<div class="checkbox-item"><input type="checkbox" id="role-${e.id}" value="${e.id}" ${t.includes(e.id)?"checked":""}><label for="role-${e.id}">${e.name}</label></div>`).join(""),showPage("assign-roles")}
    async function handleAssignRoles(e){e.preventDefault();const t=[];document.querySelectorAll('#assign-roles-list input[type="checkbox"]:checked').forEach(e=>{t.push(parseInt(e.value))}),await fetch(`/api/users/${state.selectedUserId}/roles`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({roleIds:t})}),alert("User roles saved!"),showPage("users")}
    async function handleCreateProgram(e){e.preventDefault();const d={name:e.target.elements["program-name"].value,description:e.target.elements["program-description"].value,logoUrl:e.target.elements["program-logo"].value,startDate:e.target.elements["program-start-date"].value,startTime:e.target.elements["program-start-time"].value};const p=await(await fetch("/api/programs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})).json();state.programs.push(p);renderProgramsPage();e.target.reset();showPage("programs")}
    async function handleInviteUser(e){e.preventDefault();const d={firstName:e.target.elements["user-firstname"].value,lastName:e.target.elements["user-lastname"].value,email:e.target.elements["user-email"].value};const u=await(await fetch("/api/users/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})).json();state.users.push(u);renderUsersPage();e.target.reset();showPage("users")}
    async function handleCreateRole(e){e.preventDefault();const roleName=e.target.elements["role-name"].value;const newRole=await(await fetch("/api/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:roleName})})).json();state.roles.push(newRole);renderRolesPage();e.target.reset()}
    async function handleRoleSelect(e){state.selectedRoleId=e.target.dataset.id;document.getElementById("selected-role-name").textContent=e.target.textContent;document.querySelectorAll(".role-item").forEach(item=>item.classList.remove("selected"));e.target.classList.add("selected");const assignedPermissions=await(await fetch(`/api/roles/${state.selectedRoleId}/permissions`)).json();const permissionsList=document.getElementById("permissions-list");permissionsList.innerHTML=state.permissions.map(p=>`<div class="checkbox-item"><input type="checkbox" id="perm-${p.id}" value="${p.id}" ${assignedPermissions.includes(p.id)?"checked":""}><label for="perm-${p.id}">${p.description}</label></div>`).join("");document.getElementById("save-permissions-btn").classList.remove("hidden")}
    async function handleSavePermissions(e){e.preventDefault();const checkedIds=[];document.querySelectorAll('#permissions-list input[type="checkbox"]:checked').forEach(checkbox=>{checkedIds.push(parseInt(checkbox.value))});await fetch(`/api/roles/${state.selectedRoleId}/permissions`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({permissionIds:checkedIds})});alert("Permissions saved!")}
    async function handleDeactivateUser(e){if(confirm("Are you sure?")){await fetch(`/api/users/${e.target.dataset.id}/deactivate`,{method:"PUT"});state.users=await(await fetch("/api/users")).json();renderUsersPage()}}
    async function loadAccessData(programId){const[access,requests]=await Promise.all([fetch(`/api/programs/${programId}/access`).then(res=>res.json()),fetch(`/api/programs/${programId}/requests`).then(res=>res.json())]);renderAccessList(access);renderAccessRequests(requests)}
    function renderAccessList(rights){document.getElementById("access-list").innerHTML=rights.map(r=>`<div class="list-item"><span>${r.userEmail}</span><span class="status-${r.accessLevel}">${r.accessLevel}</span></div>`).join("")}
    function renderAccessRequests(requests){document.getElementById("access-requests-list").innerHTML=requests.map(r=>`<div class="list-item"><span>${r.userEmail}</span><div><button class="approve-btn confirm-action" data-id="${r.id}">Approve</button> <button class="deny-btn destructive-action" data-id="${r.id}">Deny</button></div></div>`).join("");document.querySelectorAll(".approve-btn, .deny-btn").forEach(b=>b.addEventListener("click",handleRequest))}
    async function handleAssignAccess(e){e.preventDefault();const accessData={userId:e.target.elements["access-user-select"].value,programId:state.selectedProgramId,accessLevel:e.target.elements["access-level-select"].value};await fetch("/api/access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(accessData)});loadAccessData(state.selectedProgramId)}
    async function handleRequest(e){const requestId=e.target.dataset.id;const status=e.target.classList.contains("approve-btn")?"approved":"denied";await fetch(`/api/requests/${requestId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});loadAccessData(state.selectedProgramId)}
    async function handleBulkAssign(e){e.preventDefault();const fileInput=document.getElementById("csv-file-input");const formData=new FormData;formData.append("csvFile",fileInput.files[0]);const response=await fetch(`/api/programs/${state.selectedProgramId}/bulk-assign`,{method:"POST",body:formData});const result=await response.json();document.getElementById("bulk-assign-results").textContent=result.message;fileInput.value="";loadAccessData(state.selectedProgramId)}
    async function loadFormBuilderData(programId){state.currentProgramFields=await(await fetch(`/api/programs/${programId}/form`)).json();renderFormFields();populateParentQuestionDropdown(document.getElementById("parent-question-select"))}
    function renderFormFields(){document.getElementById("form-fields-list").innerHTML=state.currentProgramFields.map(f=>{let info=f.condition?` <em class="condition-info">(depends on '${f.condition.parentFieldKey}')</em>`:"";return`<div class="list-item"><span>'${f.label}' (key: ${f.key})${info}</span></div>`}).join("")}
    function handleFieldTypeChange(e){const optionsContainer=document.getElementById("dropdown-options-container");if(e.target.value==="dropdown"){optionsContainer.classList.remove("hidden");if(document.getElementById("dropdown-options-list").childElementCount===0)addDropdownOptionRow()}else optionsContainer.classList.add("hidden")}
    function addDropdownOptionRow(data={}){const list=document.getElementById("dropdown-options-list");const row=document.createElement("div");row.className="dropdown-option-row";row.innerHTML=`<div class="option-inputs"><input type="text" class="option-label" placeholder="Label (e.g., Small)" value="${data.label||""}"><input type="text" class="option-value" placeholder="Value (e.g., s)" value="${data.value||""}"><button type="button" class="remove-option-btn utility-btn">Remove</button></div><div class="option-condition"><a href="#" class="add-condition-link">Add Condition</a><div class="option-condition-builder hidden">Show if <select class="option-parent-question-select"></select> is <select class="option-parent-answer-select"></select></div></div>`;list.appendChild(row);populateParentQuestionDropdown(row.querySelector(".option-parent-question-select"))}
    function handleDropdownListClick(e){if(e.target.classList.contains("remove-option-btn"))e.target.closest(".dropdown-option-row").remove();if(e.target.classList.contains("add-condition-link")){e.preventDefault();e.target.nextElementSibling.classList.toggle("hidden")}if(e.target.classList.contains("option-parent-question-select")){const answerSelect=e.target.closest(".option-condition-builder").querySelector(".option-parent-answer-select");handleParentQuestionChange(e.target,answerSelect)}}
    function populateParentQuestionDropdown(selectElement){const parentCandidates=state.currentProgramFields.filter(f=>f.type==="dropdown");selectElement.innerHTML='<option value="">--Select Question--</option>'+parentCandidates.map(f=>`<option value="${f.key}">${f.label}</option>`).join("")}
    function handleParentQuestionChange(parentSelect,answerSelect){const selectedParentKey=parentSelect.value;const parentQuestion=state.currentProgramFields.find(f=>f.key===selectedParentKey);if(parentQuestion&&parentQuestion.options)answerSelect.innerHTML=parentQuestion.options.map(opt=>`<option value="${opt.value}">${opt.label}</option>`).join("");else answerSelect.innerHTML=""}
    async function handleAddField(e){e.preventDefault();const fieldType=document.getElementById("field-type-builder").value;const fieldData={label:document.getElementById("field-label-builder").value,key:document.getElementById("field-key-builder").value,type:fieldType};if(fieldType==="dropdown"){const options=[];document.querySelectorAll(".dropdown-option-row").forEach(row=>{const label=row.querySelector(".option-label").value;const value=row.querySelector(".option-value").value;if(!label)return;const optionData={label,value:value||label};const cBuilder=row.querySelector(".option-condition-builder");if(!cBuilder.classList.contains("hidden")){const pKey=cBuilder.querySelector(".option-parent-question-select").value;const pVal=cBuilder.querySelector(".option-parent-answer-select").value;if(pKey&&pVal)optionData.condition={parentFieldKey:pKey,parentAnswerValue:pVal}}options.push(optionData)});fieldData.options=options}if(document.getElementById("conditional-checkbox").checked){const pKey=document.getElementById("parent-question-select").value;const pVal=document.getElementById("parent-answer-select").value;if(pKey&&pVal)fieldData.condition={parentFieldKey:pKey,parentAnswerValue:pVal}}await fetch(`/api/programs/${state.selectedProgramId}/fields`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(fieldData)});e.target.reset();document.getElementById("dropdown-options-list").innerHTML="";document.getElementById("dropdown-options-container").classList.add("hidden");document.getElementById("conditional-logic-builder").classList.add("hidden");loadFormBuilderData(state.selectedProgramId)}
    function getUserAccessTemplate(){return`<div class="content-section"><h4>Assign Access Manually</h4><form id="assign-access-form"><select id="access-user-select"></select><select id="access-level-select"><option value="view-only">View-Only</option><option value="participate">Participate</option></select><button type="submit" class="primary-action">Assign</button></form></div><div class="content-section"><h4>Bulk Assign Access via CSV</h4><form id="bulk-assign-form"><p>Upload a CSV with columns: <strong>email, access_level</strong></p><input type="file" id="csv-file-input" accept=".csv" required><button type="submit" class="primary-action">Upload</button></form><div id="bulk-assign-results" class="results-box"></div></div><div class="content-section"><h4>Current Access</h4><div id="access-list"></div></div><div class="content-section"><h4>Pending Requests</h4><div id="access-requests-list"></div></div>`}
    function getFormBuilderTemplate(){return`<div class="content-section"><h4>Add New Question</h4><form id="add-field-form"><label for="field-label-builder">Question Label</label><input type="text" id="field-label-builder" required><label for="field-key-builder">Field Key</label><input type="text" id="field-key-builder" required><label for="field-type-builder">Question Type</label><select id="field-type-builder"><option value="text">Text</option><option value="textarea">Paragraph</option><option value="dropdown">Dropdown</option><option value="file">File Upload</option></select><div id="dropdown-options-container" class="hidden"><label>Dropdown Options</label><div id="dropdown-options-list"></div><button type="button" id="add-option-btn" class="utility-btn">Add Option</button></div><hr class="divider"><label class="conditional-toggle"><input type="checkbox" id="conditional-checkbox">Make this question conditional</label><div id="conditional-logic-builder" class="hidden"><label for="parent-question-select">Display if...</label><select id="parent-question-select"></select><label for="parent-answer-select">is:</label><select id="parent-answer-select"></select></div><button type="submit" class="primary-action">Add Question</button></form></div><div class="content-section"><h4>Current Form Questions</h4><div id="form-fields-list"></div></div>`}
    
    initializeApp();
});